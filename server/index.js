const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth",        require("./routes/auth.routes"));
app.use("/api/courses",     require("./routes/course.routes"));
app.use("/api/assessments", require("./routes/assessment.routes"));
app.use("/api/submissions", require("./routes/submission.routes"));
app.use("/api/performance", require("./routes/performance.routes"));
app.use("/api/study-sessions", require("./routes/studySession.routes"));
app.use("/api/ai",          require("./routes/ai.routes"));

// Health check
app.get("/", (req, res) => res.json({ message: "EduAI API running ✅" }));

// DB + Server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(process.env.PORT, () =>
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("❌ DB connection failed:", err));