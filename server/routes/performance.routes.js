const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Submission = require("../models/Submission.model");

// Student views their own performance
router.get("/me", protect, restrictTo("student"), async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate({ path: "assessment", select: "title topic difficulty course" });
    const stats = {
      totalAttempted: submissions.length,
      averageScore: submissions.length
        ? submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length
        : 0,
      submissions,
    };
    res.json(stats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Teacher views performance of all students in a course
router.get("/course/:courseId", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate({ path: "assessment", match: { course: req.params.courseId }, select: "title topic" })
      .populate("student", "name email");
    const filtered = submissions.filter((s) => s.assessment !== null);
    res.json(filtered);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;