const Groq            = require("groq-sdk");
const LearningPath    = require("../models/LearningPath.model");
const StudentProgress = require("../models/StudentProgress.model");
const Course          = require("../models/Course.model");
const Assessment      = require("../models/Assessment.model");
const Submission      = require("../models/Submission.model");

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── Build the prompt sent to Groq ───────────────────────────────────────────
function buildPrompt({ goal, courses, submissionSummary, weakTopics, strongTopics, today }) {
  const courseLines = courses.map(
    (c) => `"${c.title}" — ${c.completionPercent}% complete`
  );

  const materialLines = courses.flatMap((c) =>
    c.pendingMaterials.map((m) => `- [${m.type}] "${m.title}" in "${c.title}" (id: ${m._id})`)
  );

  const assessmentLines = courses.flatMap((c) =>
    c.pendingAssessments.map((a) => {
      let dueLine = "no due date";
      let urgency = "";
      if (a.dueDate) {
        const due   = new Date(a.dueDate);
        const diff  = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        dueLine = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (diff < 0)        urgency = " ⚠ OVERDUE";
        else if (diff === 0) urgency = " ⚠ DUE TODAY";
        else if (diff <= 2)  urgency = ` ⚠ DUE IN ${diff} DAY${diff > 1 ? "S" : ""}`;
        else if (diff <= 7)  urgency = ` (due in ${diff} days)`;
      }
      return `- [assessment] "${a.title}" topic:"${a.topic || "general"}" difficulty:${a.difficulty} due:${dueLine}${urgency} (id: ${a._id})`;
    })
  );

  const scoreLines =
    submissionSummary.length > 0
      ? submissionSummary.map((s) => {
          const flag = s.avgPercent < 60 ? " ⚠ weak" : s.avgPercent >= 80 ? " ✓ strong" : "";
          return `"${s.topic}": avg ${s.avgPercent}%${flag} (${s.count} attempt/s)`;
        })
      : ["No quiz results yet — student is new"];

  return `You are an expert learning coach for KalviAI, a school LMS. Generate a personalized weekly learning path for this student based on their quiz performance, assignment due dates, and course progress.

TODAY'S DATE: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
STUDENT GOAL: ${goal}

ENROLLED COURSES:
${courseLines.join("\n")}

QUIZ PERFORMANCE BY TOPIC:
${scoreLines.join("\n")}

WEAK TOPICS (avg below 60%): ${weakTopics.length > 0 ? weakTopics.join(", ") : "none identified yet"}
STRONG TOPICS (avg above 80%): ${strongTopics.length > 0 ? strongTopics.join(", ") : "none yet"}

PENDING MATERIALS NOT OPENED YET:
${materialLines.length > 0 ? materialLines.join("\n") : "None"}

PENDING ASSESSMENTS NOT SUBMITTED (with due dates):
${assessmentLines.length > 0 ? assessmentLines.join("\n") : "None"}

RULES (follow strictly):
1. Generate exactly 6 to 8 steps total
2. OVERDUE and DUE TODAY assessments must appear first with priority "high"
3. Assessments due within 2 days must be priority "high"
4. Assessments due within 7 days must be priority "medium"
5. Weak topic materials must come before strong topic materials
6. Mix material and assessment steps — do not recommend only one type
7. Each "reason" must be one sentence explaining WHY this step helps this specific student right now (mention the due date or weak topic explicitly)
8. Use estimatedMinutes: pdf=20, video=15, assessment=match its duration field

Reply ONLY with valid JSON, no markdown, no explanation, no code fences:
{
  "summary": "2-3 sentence overview mentioning quiz performance, any urgent due dates, and what this path focuses on",
  "weakTopics": ["topic1"],
  "strongTopics": ["topic1"],
  "steps": [
    {
      "order": 1,
      "type": "material or assessment or review",
      "refId": "exact _id from the lists above or null",
      "title": "Step title",
      "reason": "One sentence reason mentioning quiz score or due date",
      "estimatedMinutes": 20,
      "priority": "high or medium or low"
    }
  ]
}`;
}

// ─── Build user context from MongoDB ─────────────────────────────────────────
async function buildUserContext(userId, goal) {
  const enrolledCourses = await Course.find({ students: userId, isPublished: true });
  const progress        = await StudentProgress.findOne({ userId });

  const courses = await Promise.all(
    enrolledCourses.map(async (course) => {
      const cp           = progress?.courses.find((c) => c.courseId.toString() === course._id.toString());
      const completedIds = new Set((cp?.completedMaterials || []).map((id) => id.toString()));

      const pendingMaterials = (course.materials || [])
        .filter((m) => !completedIds.has(m._id.toString()))
        .slice(0, 4)
        .map((m) => ({ _id: m._id, title: m.title, type: m.type }));

      const assessments   = await Assessment.find({ course: course._id, isPublished: true }).select("_id title topic difficulty duration dueDate");
      const submissions   = await Submission.find({ student: userId, assessment: { $in: assessments.map((a) => a._id) } }).select("assessment");
      const submittedIds  = new Set(submissions.map((s) => s.assessment.toString()));

      const pendingAssessments = assessments
        .filter((a) => !submittedIds.has(a._id.toString()))
        .sort((a, b) => {
          const da = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
          const db = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
          return da - db;
        })
        .slice(0, 4)
        .map((a) => ({ _id: a._id, title: a.title, topic: a.topic, difficulty: a.difficulty, dueDate: a.dueDate || null }));

      return {
        title:             course.title,
        completionPercent: cp?.completionPercent || 0,
        pendingMaterials,
        pendingAssessments,
      };
    })
  );

  const allSubmissions = await Submission.find({ student: userId })
    .populate("assessment", "topic")
    .select("percentage assessment");

  const topicMap = {};
  allSubmissions.forEach((sub) => {
    const topic = sub.assessment?.topic || "General";
    if (!topicMap[topic]) topicMap[topic] = { total: 0, count: 0 };
    topicMap[topic].total += sub.percentage;
    topicMap[topic].count += 1;
  });

  const submissionSummary = Object.entries(topicMap).map(([topic, d]) => ({
    topic,
    avgPercent: Math.round(d.total / d.count),
    count:      d.count,
  }));

  return {
    goal:  goal || "Complete enrolled courses effectively",
    today: new Date(),
    courses,
    submissionSummary,
    weakTopics:   submissionSummary.filter((s) => s.avgPercent < 60).map((s) => s.topic),
    strongTopics: submissionSummary.filter((s) => s.avgPercent >= 80).map((s) => s.topic),
  };
}

// ─── GET /api/learning-path ───────────────────────────────────────────────────
const getLearningPath = async (req, res) => {
  try {
    const userId = req.user.id;
    let path = await LearningPath.findOne({ userId });

    if (path && !path.isStale && path.nextRefreshAt > new Date()) {
      return res.status(200).json({ success: true, data: path, cached: true });
    }

    const context    = await buildUserContext(userId, path?.goal);
    const prompt     = buildPrompt(context);
    const completion = await groq.chat.completions.create({
      model:      MODEL,
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    let aiData;
    try {
      aiData = JSON.parse(raw);
    } catch {
      return res.status(500).json({ success: false, message: "AI response could not be parsed. Please try again." });
    }

    const steps = (aiData.steps || []).map((s, i) => ({
      order:            s.order || i + 1,
      type:             s.type || "material",
      refId:            s.refId || null,
      title:            s.title,
      reason:           s.reason,
      estimatedMinutes: s.estimatedMinutes || 20,
      priority:         s.priority || "medium",
      completed:        false,
    }));

    path = await LearningPath.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          summary:               aiData.summary,
          goal:                  context.goal,
          weakTopics:            aiData.weakTopics   || [],
          strongTopics:          aiData.strongTopics || [],
          steps,
          totalSteps:            steps.length,
          completedSteps:        0,
          estimatedTotalMinutes: steps.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0),
          generatedAt:           new Date(),
          nextRefreshAt:         new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isStale:               false,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, data: path, cached: false });
  } catch (error) {
    console.error("Learning path error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/learning-path/step/:stepId/complete ──────────────────────────
const markStepComplete = async (req, res) => {
  try {
    const path = await LearningPath.findOne({ userId: req.user.id });
    if (!path) return res.status(404).json({ message: "No learning path found" });

    const step = path.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ message: "Step not found" });

    step.completed      = true;
    step.completedAt    = new Date();
    path.completedSteps = path.steps.filter((s) => s.completed).length;
    if (path.completedSteps >= path.totalSteps) path.isStale = true;

    await path.save();
    return res.status(200).json({ success: true, data: path });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/learning-path/goal ───────────────────────────────────────────
const updateGoal = async (req, res) => {
  try {
    const { goal } = req.body;
    if (!goal?.trim()) return res.status(400).json({ message: "Goal cannot be empty" });

    const path = await LearningPath.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { goal, isStale: true } },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true, data: path });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/learning-path/regenerate ──────────────────────────────────────
const regeneratePath = async (req, res) => {
  try {
    await LearningPath.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { isStale: true, nextRefreshAt: new Date() } }
    );
    return getLearningPath(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/learning-path/track ───────────────────────────────────────────
const trackMaterialEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, courseTitle, materialId, materialTitle, materialType, event, timeSpentSeconds } = req.body;

    let progress = await StudentProgress.findOne({ userId });
    if (!progress) progress = new StudentProgress({ userId, courses: [] });

    let cp = progress.courses.find((c) => c.courseId.toString() === courseId);
    if (!cp) {
      const course = await Course.findById(courseId);
      progress.courses.push({
        courseId,
        courseTitle:        courseTitle || course?.title,
        totalMaterials:     course?.materials?.length || 0,
        completedMaterials: [],
        materialEvents:     [],
      });
      cp = progress.courses[progress.courses.length - 1];
    }

    cp.materialEvents.push({ materialId, materialTitle, materialType, event, timeSpentSeconds: timeSpentSeconds || 0 });
    cp.totalTimeSpentSeconds += timeSpentSeconds || 0;
    cp.lastActivityAt = new Date();

    if (event === "completed") {
      const alreadyDone = cp.completedMaterials.some((id) => id.toString() === materialId);
      if (!alreadyDone) cp.completedMaterials.push(materialId);
      cp.completionPercent = cp.totalMaterials > 0
        ? Math.round((cp.completedMaterials.length / cp.totalMaterials) * 100)
        : 0;
    }

    progress.overallStats.lastActiveDate = new Date();
    await progress.save();
    await LearningPath.findOneAndUpdate({ userId }, { $set: { isStale: true } });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getLearningPath, markStepComplete, updateGoal, regeneratePath, trackMaterialEvent };
