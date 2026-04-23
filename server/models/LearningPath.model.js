const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
  order:            { type: Number, required: true },
  type:             { type: String, enum: ["material", "assessment", "review"], required: true },
  refId:            { type: mongoose.Schema.Types.ObjectId },
  title:            { type: String, required: true },
  reason:           { type: String },
  estimatedMinutes: { type: Number, default: 20 },
  priority:         { type: String, enum: ["high", "medium", "low"], default: "medium" },
  completed:        { type: Boolean, default: false },
  completedAt:      { type: Date },
});

const learningPathSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    summary:               { type: String },
    goal:                  { type: String, default: "Complete enrolled courses effectively" },
    weakTopics:            [{ type: String }],
    strongTopics:          [{ type: String }],
    steps:                 [stepSchema],
    totalSteps:            { type: Number, default: 0 },
    completedSteps:        { type: Number, default: 0 },
    estimatedTotalMinutes: { type: Number, default: 0 },
    generatedAt:           { type: Date, default: Date.now },
    nextRefreshAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    isStale: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningPath", learningPathSchema);
