const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      default: "",
    },
  },
  { _id: false, timestamps: true }
);

const aiTutorSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student ID is required"],
    },
    messages: [messageSchema],
    lastQuestion: {
      type: String,
      default: "",
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    stage: {
      type: String,
      enum: ["hint", "solution"],
      default: "hint",
    },
    documentUploaded: {
      type: Boolean,
      default: false,
    },
    documentName: {
      type: String,
      default: "",
    },
    complexity: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
aiTutorSchema.index({ student: 1, updatedAt: -1 });

const AITutor = mongoose.model("AITutor", aiTutorSchema, "aitutors");

module.exports = AITutor;
