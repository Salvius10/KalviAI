const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer:   { type: String, required: true },
});

const flashcardSetSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  topic:      { type: String },
  student:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course:     { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  flashcards: [flashcardSchema],
  // ⚠️ AI HAS TO BE CREATED HERE — AI generated flashcards will populate this
}, { timestamps: true });

module.exports = mongoose.model("FlashcardSet", flashcardSetSchema);