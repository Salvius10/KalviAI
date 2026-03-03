const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");

// ⚠️ AI HAS TO BE CREATED HERE — Assessment generation
router.post("/generate-assessment", protect, restrictTo("teacher"), (req, res) => {
  res.json({ message: "⚠️ AI Assessment Generator — to be implemented" });
});

// ⚠️ AI HAS TO BE CREATED HERE — AI Tutor (Socratic method)
router.post("/tutor", protect, restrictTo("student"), (req, res) => {
  res.json({ message: "⚠️ AI Tutor — to be implemented" });
});

// ⚠️ AI HAS TO BE CREATED HERE — Flashcard generation
router.post("/flashcards", protect, restrictTo("student"), (req, res) => {
  res.json({ message: "⚠️ AI Flashcard Generator — to be implemented" });
});

// ⚠️ AI HAS TO BE CREATED HERE — Plagiarism detection
router.post("/plagiarism", protect, restrictTo("teacher"), (req, res) => {
  res.json({ message: "⚠️ Plagiarism Detector — to be implemented" });
});

module.exports = router;