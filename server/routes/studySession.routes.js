const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const StudySession = require("../models/StudySession.model");

// Start session
router.post("/start", protect, restrictTo("student"), async (req, res) => {
  try {
    const session = await StudySession.create({
      student: req.user.id,
      course: req.body.courseId,
      startTime: new Date(),
    });
    res.status(201).json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// End session
router.put("/:id/end", protect, restrictTo("student"), async (req, res) => {
  try {
    const session = await StudySession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const endTime = new Date();
    const duration = Math.round((endTime - session.startTime) / 60000);
    const updated = await StudySession.findByIdAndUpdate(
      req.params.id,
      { endTime, duration, notes: req.body.notes || "" },
      { new: true }
    );
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get all sessions for student
router.get("/my", protect, restrictTo("student"), async (req, res) => {
  try {
    const sessions = await StudySession.find({ student: req.user.id })
      .populate("course", "title")
      .sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;