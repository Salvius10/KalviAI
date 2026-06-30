const mongoose = require("mongoose");

const materialEventSchema = new mongoose.Schema(
  {
    materialId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    materialTitle:    { type: String },
    materialType:     { type: String },
    event:            { type: String, enum: ["opened", "completed"], required: true },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const courseProgressSchema = new mongoose.Schema({
  courseId:              { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseTitle:           { type: String },
  totalMaterials:        { type: Number, default: 0 },
  completedMaterials:    [{ type: mongoose.Schema.Types.ObjectId }],
  completionPercent:     { type: Number, default: 0 },
  totalTimeSpentSeconds: { type: Number, default: 0 },
  materialEvents:        [materialEventSchema],
  lastActivityAt:        { type: Date, default: Date.now },
});

const studentProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    courses: [courseProgressSchema],
    overallStats: {
      totalCoursesEnrolled:  { type: Number, default: 0 },
      totalCoursesCompleted: { type: Number, default: 0 },
      totalTimeSpentSeconds: { type: Number, default: 0 },
      streakDays:            { type: Number, default: 0 },
      lastActiveDate:        { type: Date },
    },
  },
  { timestamps: true }
);

studentProgressSchema.pre("save", function (next) {
  const stats   = this.overallStats;
  const courses = this.courses;
  stats.totalCoursesEnrolled  = courses.length;
  stats.totalCoursesCompleted = courses.filter((c) => c.completionPercent >= 100).length;
  stats.totalTimeSpentSeconds = courses.reduce((s, c) => s + c.totalTimeSpentSeconds, 0);
  next();
});

module.exports = mongoose.model("StudentProgress", studentProgressSchema);
