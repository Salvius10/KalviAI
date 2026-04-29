const Groq            = require("groq-sdk");
const LearningPath    = require("../models/LearningPath.model");
const StudentProgress = require("../models/StudentProgress.model");
const Course          = require("../models/Course.model");
const Assessment      = require("../models/Assessment.model");
const Submission      = require("../models/Submission.model");

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt({ goal, courses, submissionSummary, weakTopics, strongTopics }) {
  const courseLines = courses.length > 0
    ? courses.map((c) => `"${c.title}" — ${c.completionPercent}% complete`)
    : ["Not enrolled in any courses yet"];

  const materialLines = courses.flatMap((c) =>
    c.pendingMaterials.map((m) => `- [${m.type}] "${m.title}" in "${c.title}" (id: ${m._id})`)
  );

  const assessmentLines = courses.flatMap((c) =>
    c.pendingAssessments.map((a) => `- [assessment] "${a.title}" topic:"${a.topic || "general"}" difficulty:${a.difficulty} (id: ${a._id})`)
  );

  const scoreLines = submissionSummary.length > 0
    ? submissionSummary.map((s) => `"${s.topic}": avg ${s.avgPercent}% (${s.count} attempt/s)`)
    : ["No assessments taken yet"];

  return `You are an expert learning coach for KalviAI, a school LMS. Generate a personalized learning path for this student.

STUDENT GOAL: ${goal}

ENROLLED COURSES:
${courseLines.join("\n")}

PAST ASSESSMENT SCORES BY TOPIC:
${scoreLines.join("\n")}

WEAK TOPICS (below 60%): ${weakTopics.length > 0 ? weakTopics.join(", ") : "none yet"}
STRONG TOPICS (above 80%): ${strongTopics.length > 0 ? strongTopics.join(", ") : "none yet"}

PENDING MATERIALS THE STUDENT HASN'T OPENED YET:
${materialLines.length > 0 ? materialLines.join("\n") : "None"}

PENDING ASSESSMENTS THE STUDENT HASN'T TAKEN YET:
${assessmentLines.length > 0 ? assessmentLines.join("\n") : "None"}

RULES:
1. Generate exactly 6 to 8 steps total
2. Put weak topic items FIRST with priority "high"
3. Mix materials and assessments — don't recommend only one type
4. Each "reason" must be exactly one sentence explaining why this helps this student
5. Use realistic estimatedMinutes: pdf=20, video=15, assessment=30

Reply ONLY with valid JSON, no markdown, no extra text:
{
  "summary": "2-3 sentence overview of where this student stands and what the path focuses on",
  "weakTopics": ["topic1"],
  "strongTopics": ["topic1"],
  "steps": [
    {
      "order": 1,
      "type": "material or assessment or review",
      "refId": "exact _id from the lists above or null",
      "title": "Step title",
      "reason": "One sentence reason",
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

      const assessments        = await Assessment.find({ course: course._id, isPublished: true }).select("_id title topic difficulty duration");
      const submissions        = await Submission.find({ student: userId, assessment: { $in: assessments.map((a) => a._id) } }).select("assessment");
      const submittedIds       = new Set(submissions.map((s) => s.assessment.toString()));
      const pendingAssessments = assessments
        .filter((a) => !submittedIds.has(a._id.toString()))
        .slice(0, 3)
        .map((a) => ({ _id: a._id, title: a.title, topic: a.topic, difficulty: a.difficulty }));

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
    goal:              goal || "Complete enrolled courses effectively",
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

    // Return cached path if still fresh
    if (path && !path.isStale && path.nextRefreshAt > new Date()) {
      return res.status(200).json({ success: true, data: path, cached: true });
    }

    // Build context and call Groq
    const context    = await buildUserContext(userId, path?.goal);
    const prompt     = buildPrompt(context);
    const completion = await groq.chat.completions.create({
      model:      MODEL,
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });

    // Strip possible markdown fences
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
      { upsert: true, returnDocument: "after" }
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
      { upsert: true, returnDocument: "after" }
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