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
  submissionType:   { type: String, enum: ["quiz", "pdf_assignment"], default: "quiz" },
  answers:          [answerSchema],
  totalScore:       { type: Number, default: 0 },
  maxScore:         { type: Number, default: 0 },
  percentage:       { type: Number, default: 0 },
  submittedAt:      { type: Date, default: Date.now },
  fileUrl:          { type: String, default: "" },
  fileName:         { type: String, default: "" },
  fileHash:         { type: String, default: "", index: true },
  extractedText:    { type: String, default: "" },
  plagiarismScore:  { type: Number, default: 0 },   // 0-100
  plagiarismFlag:   { type: Boolean, default: false },
  // ⚠️ AI HAS TO BE CREATED HERE — plagiarism analysis result field
  plagiarismReport: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Submission", submissionSchema);
