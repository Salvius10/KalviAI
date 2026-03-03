const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  type:     { type: String, enum: ["pdf", "video", "link", "text"], required: true },
  url:      { type: String },
  content:  { type: String },
}, { timestamps: true });

const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  teacher:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  students:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  materials:   [materialSchema],
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Course", courseSchema);