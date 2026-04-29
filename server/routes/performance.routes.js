const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Course = require("../models/Course.model");
const Submission = require("../models/Submission.model");

const getLearnerBand = (averageScore, scoredAttempts) => {
  if (!scoredAttempts) {
    return {
      status: "no_data",
      label: "No data",
      note: "No graded assessments yet.",
    };
  }

  if (averageScore < 40) {
    return {
      status: "high_risk",
      label: "High risk",
      note: "Needs immediate support and close follow-up.",
    };
  }

  if (averageScore < 60) {
    return {
      status: "watchlist",
      label: "Watchlist",
      note: "Showing weak marks and may require intervention.",
    };
  }

  return {
    status: "on_track",
    label: "On track",
    note: "Performing within the expected range.",
  };
};

// Student views their own performance
router.get("/me", protect, restrictTo("student"), async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate({ path: "assessment", select: "title topic difficulty course" })
      .sort({ createdAt: -1 });

    const quizSubmissions = submissions.filter((s) => (s.submissionType || "quiz") === "quiz");
    const pdfSubmissions  = submissions.filter((s) => s.submissionType === "pdf_assignment");

    const averageScore = quizSubmissions.length
      ? quizSubmissions.reduce((s, sub) => s + sub.percentage, 0) / quizSubmissions.length
      : 0;

    const recentActivity = submissions.slice(0, 10).map((s) => ({
      id: s._id,
      title: s.assessment?.title || "Assessment",
      topic: s.assessment?.topic || "General",
      type: s.submissionType || "quiz",
      percentage: Math.round(s.percentage || 0),
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      submittedAt: s.createdAt,
    }));

    const stats = {
      totalAttempted: submissions.length,
      quizCount: quizSubmissions.length,
      pdfCount: pdfSubmissions.length,
      averageScore,
      highestScore: quizSubmissions.length ? Math.max(...quizSubmissions.map((s) => s.percentage)) : 0,
      lowestScore:  quizSubmissions.length ? Math.min(...quizSubmissions.map((s) => s.percentage)) : 0,
      passCount: quizSubmissions.filter((s) => s.percentage >= 70).length,
      failCount: quizSubmissions.filter((s) => s.percentage < 70).length,
      submissions,
      recentActivity,
      lastUpdated: new Date(),
    };
    res.json(stats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Teacher views performance of all students in a course
router.get("/course/:courseId", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.courseId,
      teacher: req.user.id,
    }).select("title students");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const submissions = await Submission.find()
      .populate({
        path: "assessment",
        match: { course: req.params.courseId },
        select: "title topic difficulty",
      })
      .populate("student", "name email rollNo");

    const filtered = submissions
      .filter((submission) => submission.assessment && submission.student)
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt));
    const scoredSubmissions = filtered.filter((submission) => (submission.submissionType || "quiz") === "quiz");

    const pdfSubs  = filtered.filter((s) => s.submissionType === "pdf_assignment");
    const quizSubs = filtered.filter((s) => (s.submissionType || "quiz") === "quiz");

    const overview = {
      totalStudents: course.students?.length || 0,
      activeStudents: new Set(filtered.map((submission) => String(submission.student._id))).size,
      totalSubmissions: filtered.length,
      quizSubmissions: quizSubs.length,
      pdfSubmissions: pdfSubs.length,
      averageScore: scoredSubmissions.length
        ? scoredSubmissions.reduce((sum, submission) => sum + submission.percentage, 0) / scoredSubmissions.length
        : 0,
      passCount: scoredSubmissions.filter((submission) => submission.percentage >= 70).length,
      failCount: scoredSubmissions.filter((submission) => submission.percentage < 70).length,
      plagiarismFlags: filtered.filter((submission) => submission.plagiarismFlag).length,
      lastUpdated: new Date(),
    };

    const studentMap = new Map();
    for (const submission of filtered) {
      const studentId = String(submission.student._id);
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          name: submission.student.name,
          email: submission.student.email,
          rollNo: submission.student.rollNo || "",
          attempts: 0,
          scoredAttempts: 0,
          totalScore: 0,
          bestScore: 0,
          passedCount: 0,
          failedCount: 0,
          plagiarismFlags: 0,
          lastSubmittedAt: submission.submittedAt || submission.createdAt,
          assessments: [],
        });
      }

      const student = studentMap.get(studentId);
      student.attempts += 1;
      if ((submission.submissionType || "quiz") === "quiz") {
        student.scoredAttempts += 1;
        student.totalScore += submission.percentage;
        student.bestScore = Math.max(student.bestScore, submission.percentage);
        student.passedCount += submission.percentage >= 70 ? 1 : 0;
        student.failedCount += submission.percentage < 70 ? 1 : 0;
      }
      student.plagiarismFlags += submission.plagiarismFlag ? 1 : 0;

      const submittedAt = submission.submittedAt || submission.createdAt;
      if (submittedAt && (!student.lastSubmittedAt || new Date(submittedAt) > new Date(student.lastSubmittedAt))) {
        student.lastSubmittedAt = submittedAt;
      }

      student.assessments.push({
        submissionId: submission._id,
        assessmentId: submission.assessment._id,
        assessmentTitle: submission.assessment.title,
        submissionType: submission.submissionType || "quiz",
        percentage: submission.percentage,
        totalScore: submission.totalScore,
        maxScore: submission.maxScore,
        plagiarismFlag: submission.plagiarismFlag,
        submittedAt,
      });
    }

    const studentAnalytics = Array.from(studentMap.values())
      .map((student) => ({
        ...student,
        averageScore: student.scoredAttempts
          ? student.totalScore / student.scoredAttempts
          : 0,
        learnerBand: getLearnerBand(
          student.scoredAttempts ? student.totalScore / student.scoredAttempts : 0,
          student.scoredAttempts
        ),
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const slowLearners = studentAnalytics.filter((student) =>
      student.learnerBand.status === "high_risk" || student.learnerBand.status === "watchlist"
    );

    overview.slowLearnerCount = slowLearners.length;
    overview.highRiskCount = slowLearners.filter((student) => student.learnerBand.status === "high_risk").length;

    const assessmentMap = new Map();
    for (const submission of filtered) {
      const assessmentId = String(submission.assessment._id);
      if (!assessmentMap.has(assessmentId)) {
        assessmentMap.set(assessmentId, {
          assessmentId,
          title: submission.assessment.title,
          topic: submission.assessment.topic || "",
          difficulty: submission.assessment.difficulty || "medium",
          submissions: 0,
          scoredSubmissions: 0,
          totalScore: 0,
          passCount: 0,
        });
      }

      const assessment = assessmentMap.get(assessmentId);
      assessment.submissions += 1;
      if ((submission.submissionType || "quiz") === "quiz") {
        assessment.scoredSubmissions += 1;
        assessment.totalScore += submission.percentage;
        assessment.passCount += submission.percentage >= 70 ? 1 : 0;
      }
    }

    const assessmentBreakdown = Array.from(assessmentMap.values()).map((assessment) => ({
      ...assessment,
      averageScore: assessment.scoredSubmissions ? assessment.totalScore / assessment.scoredSubmissions : 0,
      passRate: assessment.scoredSubmissions ? (assessment.passCount / assessment.scoredSubmissions) * 100 : 0,
    }));

    res.json({
      course: {
        _id: course._id,
        title: course.title,
      },
      overview,
      studentAnalytics,
      slowLearners,
      assessmentBreakdown,
      submissions: filtered,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
