const express = require("express");
const router  = express.Router();

// ─── IMPORTANT ───────────────────────────────────────────────────────────────
// Change the line below to match YOUR auth middleware file.
// Run "ls server/middleware/" to see what file you have.
// Then look inside it to see what the export is called (protect, verifyToken, etc.)
// and change BOTH the require path AND the name below to match.
// ─────────────────────────────────────────────────────────────────────────────
const { protect } = require("../middleware/authMiddleware");

const {
  getLearningPath,
  markStepComplete,
  updateGoal,
  regeneratePath,
  trackMaterialEvent,
} = require("../controllers/learningPathController");

router.use(protect);

router.get("/",                        getLearningPath);
router.post("/regenerate",             regeneratePath);
router.patch("/goal",                  updateGoal);
router.patch("/step/:stepId/complete", markStepComplete);
router.post("/track",                  trackMaterialEvent);

module.exports = router;
