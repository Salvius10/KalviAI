const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const {
  tutor,
  getChatHistory,
  clearChatHistory,
  generateAssessment,
  generateFlashcards,
  detectPlagiarism,
} = require("../controllers/ai.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post("/generate-assessment", protect, restrictTo("teacher"), generateAssessment);


router.get("/tutor/history", protect, restrictTo("student"), getChatHistory);


router.delete("/tutor/history", protect, restrictTo("student"), clearChatHistory);
// ⚠️ AI HAS TO BE CREATED HERE — AI Tutor (Socratic method)
router.post("/tutor", protect, restrictTo("student"), upload.single("document"), tutor);

// ⚠️ AI HAS TO BE CREATED HERE — Flashcard generation
router.post("/flashcards", protect, restrictTo("student"), generateFlashcards);

// ⚠️ AI HAS TO BE CREATED HERE — Plagiarism detection
router.post("/plagiarism", protect, restrictTo("teacher"), detectPlagiarism);

module.exports = router;