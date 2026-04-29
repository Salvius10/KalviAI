const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const normalizeRollNo = (value = "") => String(value).trim().toUpperCase();

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  rollNo: user.rollNo || "",
  linkedStudent: user.linkedStudent || null,
});

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      name: user.name,
      rollNo: user.rollNo || "",
      linkedStudent: user.linkedStudent || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(role || "").trim().toLowerCase();
    const normalizedRollNo = normalizeRollNo(req.body.rollNo);

    if (!name || !normalizedEmail || !password || !normalizedRole) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["teacher", "student"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Only teacher and student accounts can be created here" });
    }

    if (normalizedRole === "student" && !normalizedRollNo) {
      return res.status(400).json({ message: "Student roll number is required" });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    if (normalizedRole === "student") {
      const existingRollNo = await User.findOne({ rollNo: normalizedRollNo });
      if (existingRollNo) {
        return res.status(400).json({ message: "Roll number already in use" });
      }
    }

    const user = new User({
      name,
      email: normalizedEmail,
      password,
      role: normalizedRole,
      rollNo: normalizedRole === "student" ? normalizedRollNo : undefined,
    });
    await user.save();

    const token = signToken(user);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const portal = String(req.body.portal || "student").trim().toLowerCase();
    const password = String(req.body.password || "");
    const email = String(req.body.email || "").trim().toLowerCase();
    const rollNo = normalizeRollNo(req.body.rollNo);

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    let user = null;

    if (portal === "teacher") {
      if (!email) {
        return res.status(400).json({ message: "Teacher email is required" });
      }
      user = await User.findOne({ email, role: "teacher" });
    } else if (portal === "student") {
      if (!email || !rollNo) {
        return res.status(400).json({ message: "Student email, roll number, and password are required" });
      }
      user = await User.findOne({ email, rollNo, role: "student" });
    } else if (portal === "parent") {
      if (!rollNo) {
        return res.status(400).json({ message: "Student roll number and parent password are required" });
      }
      const student = await User.findOne({ rollNo, role: "student" }).select("_id");
      if (!student) {
        return res.status(404).json({ message: "No student found for this roll number" });
      }
      user = await User.findOne({ linkedStudent: student._id, role: "parent" });
    } else {
      return res.status(400).json({ message: "Invalid login portal" });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.registerParent = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    const rollNo = normalizeRollNo(req.body.rollNo);

    if (!name || !password || !rollNo) {
      return res.status(400).json({ message: "Parent name, student roll number, and password are required" });
    }

    const student = await User.findOne({ rollNo, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student roll number not found" });
    }

    const existingParent = await User.findOne({ linkedStudent: student._id, role: "parent" });
    if (existingParent) {
      return res.status(400).json({ message: "Parent account already exists for this student" });
    }

    const parent = new User({
      name,
      email: `parent+${rollNo.toLowerCase()}@kalviai.local`,
      password,
      role: "parent",
      linkedStudent: student._id,
      rollNo: undefined,
    });

    await parent.save();

    const token = signToken(parent);
    res.status(201).json({
      token,
      user: sanitizeUser(parent),
    });
  } catch (err) {
    console.error("Parent register error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
