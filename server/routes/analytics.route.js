const express = require("express");
const router  = express.Router();

// ─── IMPORTANT ───────────────────────────────────────────────────────────────
// Same as learningPath.route.js — change this to match your auth middleware.
// ─────────────────────────────────────────────────────────────────────────────
const { protect } = require("../middleware/authMiddleware");

const { getMyAnalytics, getAIInsight } = require("../controllers/analyticsController");

router.use(protect);

router.get("/me",         getMyAnalytics);
router.get("/ai-insight", getAIInsight);

module.exports = router;
