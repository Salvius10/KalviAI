const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Assessment = require("../models/Assessment.model");

router.get("/course/:courseId", protect, async (req, res) => {
  try {
    const assessments = await Assessment.find({ course: req.params.courseId });
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