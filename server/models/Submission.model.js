const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  question:      { type: mongoose.Schema.Types.ObjectId },
  studentAnswer: { type: String },
  isCorrect:     { type: Boolean },
  marksAwarded:  { type: Number, default: 0 },
});

const submissionSchema = new mongoose.Schema({
  assessment:       { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
  student:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  answers:          [answerSchema],
  totalScore:       { type: Number, default: 0 },
  maxScore:         { type: Number, default: 0 },
  percentage:       { type: Number, default: 0 },
  submittedAt:      { type: Date, default: Date.now },
  plagiarismScore:  { type: Number, default: 0 },   // 0-100
  plagiarismFlag:   { type: Boolean, default: false },
  // ⚠️ AI HAS TO BE CREATED HERE — plagiarism analysis result field
  plagiarismReport: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Submission", submissionSchema);