const OpenAI          = require("openai");
const StudentProgress = require("../models/StudentProgress.model");
const Submission      = require("../models/Submission.model");
const Course          = require("../models/Course.model");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── GET /api/analytics/me ────────────────────────────────────────────────────
const getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    const [progress, submissions, enrolledCourses] = await Promise.all([
      StudentProgress.findOne({ userId }),
      Submission.find({ student: userId })
        .populate("assessment", "topic title")
        .select("percentage submittedAt assessment"),
      Course.find({ students: userId, isPublished: true }).select("title materials"),
    ]);

    // Weekly activity — last 7 days
    const now = new Date();
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const date     = new Date(now);
      date.setDate(now.getDate() - (6 - i));
      const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

      const events = (progress?.courses || []).flatMap((c) =>
        (c.materialEvents || []).filter((e) => {
          const t = new Date(e.createdAt);
          return t >= dayStart && t <= dayEnd;
        })
      );

      return {
        day:                date.toLocaleDateString("en-US", { weekday: "short" }),
        materialsCompleted: events.filter((e) => e.event === "completed").length,
        minutesStudied:     Math.round(events.reduce((s, e) => s + (e.timeSpentSeconds || 0), 0) / 60),
      };
    });

    // Topic performance from submissions
    const topicMap = {};
    submissions.forEach((sub) => {
      const topic = sub.assessment?.topic || "General";
      if (!topicMap[topic]) topicMap[topic] = { scores: [], count: 0 };
      topicMap[topic].scores.push(sub.percentage);
      topicMap[topic].count += 1;
    });

    const topicPerformance = Object.entries(topicMap).map(([topic, d]) => ({
      topic,
      avgScore: Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length),
      attempts: d.count,
    }));

    // Course summaries
    const courses = enrolledCourses.map((course) => {
      const cp = progress?.courses.find((c) => c.courseId.toString() === course._id.toString());
      return {
        courseId:              course._id,
        courseTitle:           course.title,
        totalMaterials:        course.materials?.length || 0,
        completedMaterials:    cp?.completedMaterials?.length || 0,
        completionPercent:     cp?.completionPercent || 0,
        totalTimeSpentSeconds: cp?.totalTimeSpentSeconds || 0,
      };
    });

    const avgAssessmentScore = submissions.length > 0
      ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overallStats: {
          ...(progress?.overallStats?.toObject?.() || progress?.overallStats || {}),
          totalAssessmentsTaken: submissions.length,
          avgAssessmentScore,
        },
        courses,
        weeklyActivity,
        topicPerformance,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/analytics/ai-insight ───────────────────────────────────────────
const getAIInsight = async (req, res) => {
  try {
    const userId = req.user._id;

    const [progress, submissions, enrolledCourses] = await Promise.all([
      StudentProgress.findOne({ userId }),
      Submission.find({ student: userId })
        .populate("assessment", "topic")
        .select("percentage assessment"),
      Course.find({ students: userId, isPublished: true }).select("title"),
    ]);

    const stats      = progress?.overallStats || {};
    const totalHours = Math.round((stats.totalTimeSpentSeconds || 0) / 3600);

    const topicMap = {};
    submissions.forEach((sub) => {
      const topic = sub.assessment?.topic || "General";
      if (!topicMap[topic]) topicMap[topic] = [];
      topicMap[topic].push(sub.percentage);
    });

    const topicLines = Object.entries(topicMap)
      .map(([t, scores]) => `${t}: avg ${Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)}%`)
      .join(", ");

    const courseLines = enrolledCourses.map((c) => {
      const cp = progress?.courses.find((p) => p.courseId.toString() === c._id.toString());
      return `"${c.title}" ${cp?.completionPercent || 0}% done`;
    }).join("; ");

    const avgScore = submissions.length > 0
      ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length)
      : 0;

    const prompt = `You are a warm and encouraging learning coach for KalviAI, a school LMS. Write a personalized 3-4 sentence performance insight for this student. Be specific about what they are doing well and give ONE concrete actionable suggestion.

STUDENT DATA:
- Courses: ${courseLines || "Not enrolled in any courses yet"}
- Total study time: ${totalHours} hours
- Assessments taken: ${submissions.length}
- Average assessment score: ${avgScore}%
- Performance by topic: ${topicLines || "No assessments taken yet"}
- Day streak: ${stats.streakDays || 0} days

Write only 3-4 sentences. No bullet points. No headers. Be warm, specific, and motivating.`;

    const completion = await openai.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 300,
      messages:   [{ role: "user", content: prompt }],
    });

    res.status(200).json({
      success: true,
      insight: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("AI insight error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyAnalytics, getAIInsight };
