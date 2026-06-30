const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  type:         { type: String, enum: ["mcq", "short_answer", "descriptive"], required: true },
  options:      [{ type: String }],         // For MCQ
  correctAnswer:{ type: String },           // For MCQ/short_answer
  marks:        { type: Number, default: 1 },
});

const assessmentSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  course:      { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  teacher:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assessmentType: { type: String, enum: ["quiz", "pdf_assignment"], default: "quiz" },
  instructions: { type: String, default: "" },
  questions:   [questionSchema],
  duration:    { type: Number, default: 60 },  // minutes
  dueDate:     { type: Date },
  isPublished: { type: Boolean, default: false },
  topic:       { type: String },
  difficulty:  { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  sourceFile:  {
    fileName: { type: String },
    fileType: { type: String },
    url:      { type: String },
  },
}, { timestamps: true });

module.exports = mongoose.model("Assessment", assessmentSchema);
