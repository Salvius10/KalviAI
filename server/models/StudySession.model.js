const mongoose = require("mongoose");

const studySessionSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  startTime: { type: Date, required: true },
  endTime:   { type: Date },
  duration:  { type: Number, default: 0 }, // in minutes
  notes:     { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("StudySession", studySessionSchema);