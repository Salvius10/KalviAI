const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Course = require("../models/Course.model");

// GET all published courses (for student browse) — must be BEFORE /:id
router.get("/all", protect, async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate("teacher", "name email")
      .populate("students", "name email");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET courses based on role
router.get("/", protect, async (req, res) => {
  try {
    let courses;
    if (req.user.role === "teacher") {
      courses = await Course.find({ teacher: req.user.id })
        .populate("teacher", "name email")
        .populate("students", "name email");
    } else {
      courses = await Course.find({ isPublished: true })
        .populate("teacher", "name email")
        .populate("students", "name email");
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single course
router.get("/:id", protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("students", "name email");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE course (teacher only)
router.post("/", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const course = await Course.create({ ...req.body, teacher: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE course
router.put("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE course
router.delete("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Enroll student into course
router.post("/:id/enroll", protect, restrictTo("student"), async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: req.user.id } },
      { new: true }
    );
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;