const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const normalizeOrigin = (value = "") =>
  value.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");

const allowedOrigins = (
  process.env.CLIENT_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow tools like curl/Postman (no browser origin header).
    if (!origin) return callback(null, true);

    const requestOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth",           require("./routes/auth.routes"));
app.use("/api/courses",        require("./routes/course.routes"));
app.use("/api/assessments",    require("./routes/assessment.routes"));
app.use("/api/submissions",    require("./routes/submission.routes"));
app.use("/api/performance",    require("./routes/performance.routes"));
app.use("/api/study-sessions", require("./routes/studySession.routes"));
app.use("/api/parents",        require("./routes/parent.routes"));
app.use("/api/ai",             require("./routes/ai.routes"));
const learningPathRoutes = require("./routes/learningPath.route");
const analyticsRoutes    = require("./routes/analytics.route");
app.use("/api/learning-path", learningPathRoutes);
app.use("/api/analytics",     analyticsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  if (err.message?.startsWith("CORS blocked for origin:")) {
    return res.status(403).json({ message: err.message });
  }
  console.error("💥 Global Error:", err);
  res.status(500).json({ message: err.message });
});

// Health checks
app.get("/", (req, res) => res.json({ message: "EduAI API running ✅" }));
app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    message: "KalviAI backend reachable",
    allowedOrigins,
    timestamp: new Date().toISOString(),
  })
);

// Start server first so frontend-backend connectivity can be verified
// even if the database is temporarily unavailable.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("✅ CORS allowed origins:", allowedOrigins);
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => console.error("❌ DB connection failed:", err));
