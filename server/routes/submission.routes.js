const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Submission = require("../models/Submission.model");
const Assessment = require("../models/Assessment.model");

// Submit an assessment
router.post("/", protect, restrictTo("student"), async (req, res) => {
  try {
    const { assessmentId, answers } = req.body;
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    let totalScore = 0;
    const maxScore = assessment.questions.reduce((sum, q) => sum + q.marks, 0);

    const gradedAnswers = assessment.questions.map((q, i) => {
      const studentAnswer = answers[i]?.studentAnswer || "";
      const isCorrect = q.type !== "descriptive" && studentAnswer.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
      const marksAwarded = isCorrect ? q.marks : 0;
      totalScore += marksAwarded;
      return { question: q._id, studentAnswer, isCorrect, marksAwarded };
    });

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // ⚠️ AI HAS TO BE CREATED HERE — Run plagiarism check before saving

    const submission = await Submission.create({
      assessment: assessmentId,
      student: req.user.id,
      answers: gradedAnswers,
      totalScore,
      maxScore,
      percentage,
    });

    res.status(201).json(submission);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get submissions for a student
router.get("/my", protect, restrictTo("student"), async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate("assessment", "title course");
    res.json(submissions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get all submissions for an assessment (teacher)
router.get("/assessment/:assessmentId", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const submissions = await Submission.find({ assessment: req.params.assessmentId })
      .populate("student", "name email");
    res.json(submissions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;