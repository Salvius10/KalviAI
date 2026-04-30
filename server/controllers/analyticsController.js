const Groq            = require("groq-sdk");
const User            = require("../models/User.model");
const StudentProgress = require("../models/StudentProgress.model");
const Submission      = require("../models/Submission.model");
const Assessment      = require("../models/Assessment.model");
const Course          = require("../models/Course.model");

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── GET /api/analytics/me ────────────────────────────────────────────────────
const getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, progress, submissions, enrolledCourses] = await Promise.all([
      User.findById(userId).select("attendance name"),
      StudentProgress.findOne({ userId }),
      Submission.find({ student: userId })
        .populate("assessment", "topic title assessmentType dueDate")
        .select("percentage submittedAt assessment submissionType totalScore maxScore"),
      Course.find({ students: userId, isPublished: true }).select("title materials"),
    ]);

    // Weekly activity — last 7 days
    const now = new Date();
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const date     = new Date(now);
      date.setDate(now.getDate() - (6 - i));
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

    // Separate quiz vs assignment submissions
    const quizSubs = submissions.filter(
      (s) => (s.submissionType || s.assessment?.assessmentType) === "quiz"
    );
    const pdfSubs = submissions.filter(
      (s) => (s.submissionType || s.assessment?.assessmentType) === "pdf_assignment"
    );

    // Topic performance — quizzes only
    const topicMap = {};
    quizSubs.forEach((sub) => {
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
      const cp = (progress?.courses || []).find((c) => c.courseId.toString() === course._id.toString());
      return {
        courseId:              course._id,
        courseTitle:           course.title,
        totalMaterials:        course.materials?.length || 0,
        completedMaterials:    cp?.completedMaterials?.length || 0,
        completionPercent:     cp?.completionPercent || 0,
        totalTimeSpentSeconds: cp?.totalTimeSpentSeconds || 0,
      };
    });

    const avgQuizScore = quizSubs.length > 0
      ? Math.round(quizSubs.reduce((s, sub) => s + sub.percentage, 0) / quizSubs.length)
      : 0;

    const avgAssessmentScore = submissions.length > 0
      ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length)
      : 0;

    const attendance = user?.attendance || { present: 0, absent: 0 };

    return res.status(200).json({
      success: true,
      data: {
        overallStats: {
          totalCoursesEnrolled:   enrolledCourses.length,
          totalCoursesCompleted:  courses.filter((c) => c.completionPercent >= 100).length,
          totalTimeSpentSeconds:  progress?.overallStats?.totalTimeSpentSeconds || 0,
          streakDays:             progress?.overallStats?.streakDays || 0,
          totalAssessmentsTaken:  submissions.length,
          quizzesTaken:           quizSubs.length,
          assignmentsSubmitted:   pdfSubs.length,
          avgAssessmentScore,
          avgQuizScore,
          attendance,
        },
        courses,
        weeklyActivity,
        topicPerformance,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/analytics/ai-insight ───────────────────────────────────────────
const getAIInsight = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, progress, submissions, enrolledCourses] = await Promise.all([
      User.findById(userId).select("attendance name"),
      StudentProgress.findOne({ userId }),
      Submission.find({ student: userId })
        .populate("assessment", "topic title assessmentType dueDate")
        .select("percentage submittedAt assessment submissionType totalScore maxScore"),
      Course.find({ students: userId, isPublished: true }).select("title"),
    ]);

    const stats      = progress?.overallStats || {};
    const totalHours = Math.round((stats.totalTimeSpentSeconds || 0) / 3600);
    const attendance = user?.attendance || { present: 0, absent: 0 };
    const totalDays  = (attendance.present || 0) + (attendance.absent || 0);
    const attendancePct = totalDays > 0
      ? Math.round((attendance.present / totalDays) * 100)
      : null;

    // Split by type
    const quizSubs = submissions.filter(
      (s) => (s.submissionType || s.assessment?.assessmentType) === "quiz"
    );
    const pdfSubs  = submissions.filter(
      (s) => (s.submissionType || s.assessment?.assessmentType) === "pdf_assignment"
    );

    // Quiz topic breakdown
    const topicMap = {};
    quizSubs.forEach((sub) => {
      const topic = sub.assessment?.topic || "General";
      if (!topicMap[topic]) topicMap[topic] = [];
      topicMap[topic].push(sub.percentage);
    });

    const topicLines = Object.entries(topicMap)
      .map(([t, scores]) => {
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        const flag = avg < 60 ? " ⚠ weak" : avg >= 80 ? " ✓ strong" : "";
        return `${t}: avg ${avg}%${flag} (${scores.length} attempt/s)`;
      })
      .join("\n  ");

    const courseLines = enrolledCourses.map((c) => {
      const cp = (progress?.courses || []).find((p) => p.courseId.toString() === c._id.toString());
      return `"${c.title}" — ${cp?.completionPercent || 0}% done`;
    }).join("\n  ");

    const avgQuizScore = quizSubs.length > 0
      ? Math.round(quizSubs.reduce((s, sub) => s + sub.percentage, 0) / quizSubs.length)
      : 0;

    const avgPdfScore = pdfSubs.length > 0
      ? Math.round(pdfSubs.reduce((s, sub) => s + sub.percentage, 0) / pdfSubs.length)
      : 0;

    // Recent quiz results (last 5)
    const recentQuizLines = quizSubs
      .slice(-5)
      .map((s) => `"${s.assessment?.title || "Quiz"}": ${Math.round(s.percentage)}% — ${s.percentage >= 60 ? "passed" : "failed"}`)
      .join("\n  ");

    // Assignment submissions
    const assignmentLines = pdfSubs
      .map((s) => {
        const due = s.assessment?.dueDate
          ? new Date(s.assessment.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "no due date";
        const onTime = s.assessment?.dueDate
          ? new Date(s.submittedAt) <= new Date(s.assessment.dueDate)
          : null;
        const status = onTime === true ? "on time" : onTime === false ? "late" : "submitted";
        return `"${s.assessment?.title || "Assignment"}": ${Math.round(s.percentage)}% — ${status}`;
      })
      .join("\n  ");

    const prompt = `You are a warm, honest, and encouraging learning coach for KalviAI, a school LMS. Write a personalised 4-5 sentence performance insight for this student. Be specific — mention quiz scores by topic, assignment performance, and attendance. Give exactly TWO concrete actionable suggestions (one for academics, one for attendance or consistency).

STUDENT PROFILE:
- Study time logged: ${totalHours} hours total
- Day streak: ${stats.streakDays || 0} days

QUIZ RESULTS (${quizSubs.length} quizzes taken, avg ${avgQuizScore}%):
  ${topicLines || "No quizzes taken yet"}

RECENT QUIZ PERFORMANCE:
  ${recentQuizLines || "None"}

ASSIGNMENT SUBMISSIONS (${pdfSubs.length} submitted, avg ${pdfSubs.length > 0 ? avgPdfScore + "%" : "N/A"}):
  ${assignmentLines || "No assignments submitted yet"}

ATTENDANCE:
  Present: ${attendance.present} days | Absent: ${attendance.absent} days${attendancePct !== null ? ` | Rate: ${attendancePct}%` : ""}

COURSE PROGRESS:
  ${courseLines || "Not enrolled in any courses yet"}

FORMAT: Write 4-5 sentences in flowing prose. No bullet points, no headers, no lists. Be warm and specific. End with two clear actionable suggestions.`;

    const completion = await groq.chat.completions.create({
      model:       MODEL,
      max_tokens:  450,
      temperature: 0.7,
      messages:    [{ role: "user", content: prompt }],
    });

    return res.status(200).json({
      success: true,
      insight: completion.choices[0].message.content.trim(),
    });
  } catch (error) {
    console.error("AI insight error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyAnalytics, getAIInsight };
