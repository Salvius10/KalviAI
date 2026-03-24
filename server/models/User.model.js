const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const behaviourNoteSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: function requiredEmail() {
        return this.role !== "parent";
      },
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["teacher", "student", "parent"], required: true },
    avatar: { type: String, default: "" },
    rollNo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    linkedStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
    },
    attendance: {
      present: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
    },
    behaviourNotes: [behaviourNoteSchema],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
