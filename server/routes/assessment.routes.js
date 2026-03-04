const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Assessment = require("../models/Assessment.model");
const Course = require("../models/Course.model");

// GET assessments for a specific course
router.get("/course/:courseId", protect, async (req, res) => {
  try {
    const assessments = await Assessment.find({
      course: req.params.courseId,
      isPublished: true,
    });
    res.json(assessments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET all assessments for student (from all published courses)
router.get("/student/all", protect, restrictTo("student"), async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true });
    const courseIds = courses.map(c => c._id);
    const assessments = await Assessment.find({
      course: { $in: courseIds },
      isPublished: true,
    }).populate("course", "title");
    res.json(assessments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Not found" });
    res.json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const assessment = await Assessment.create({ ...req.body, teacher: req.user.id });
    res.status(201).json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    await Assessment.findByIdAndDelete(req.params.id);
    res.json({ message: "Assessment deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;