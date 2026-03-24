const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Course = require("../models/Course.model");
const User = require("../models/User.model");
const { createCourse, updateCourse } = require("../controllers/course.controller");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/materials");
    // Multer writes before controller runs, so ensure directory exists here.
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow PDF, Word, and text files
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExts = [".pdf", ".doc", ".docx", ".txt"];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const optionalUploadAny = (req, res, next) => {
  const contentType = req.headers['content-type'] || ''
  if (contentType.includes('multipart/form-data')) {
    return upload.any()(req, res, next)
  }
  return next()
}

// GET all published courses (for student browse) — must be BEFORE /:id
router.get("/all", protect, async (req, res) => {
  try {
    const filter =
      req.user.role === "teacher"
        ? { teacher: req.user.id }
        : { isPublished: true, students: req.user.id };

    const courses = await Course.find(filter)
      .populate("teacher", "name email")
      .populate("students", "name email rollNo");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET courses based on role
router.get("/", protect, async (req, res) => {
  try {
    let courses;
    if (req.user.role === "teacher") {
      courses = await Course.find({ teacher: req.user.id })
        .populate("teacher", "name email")
        .populate("students", "name email rollNo");
    } else {
      courses = await Course.find({ isPublished: true, students: req.user.id })
        .populate("teacher", "name email")
        .populate("students", "name email rollNo");
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single course
router.get("/:id", protect, async (req, res) => {
  try {
    const filter =
      req.user.role === "teacher"
        ? { _id: req.params.id, teacher: req.user.id }
        : { _id: req.params.id, isPublished: true, students: req.user.id };

    const course = await Course.findOne(filter)
      .populate("teacher", "name email")
      .populate("students", "name email rollNo");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE course (teacher only)
router.post("/", protect, restrictTo("teacher"), optionalUploadAny, createCourse);

// UPDATE course
router.put("/:id", protect, restrictTo("teacher"), optionalUploadAny, updateCourse);

// DELETE course
router.delete("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Enroll student into course
router.post("/:id/enroll", protect, restrictTo("student"), async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      isPublished: true,
      students: req.user.id,
    })
      .populate("teacher", "name email")
      .populate("students", "name email");

    if (!course) {
      return res.status(403).json({ message: "Course is not assigned to this student." });
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/students", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Student email is required" });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (String(course.teacher) !== String(req.user.id)) {
      const owner = await User.findById(course.teacher).select("email name").lean();
      return res.status(403).json({
        message: owner?.email
          ? `This course belongs to ${owner.email}. Log in with that teacher account to assign students.`
          : "You do not have permission to assign students to this course.",
      });
    }

    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const student = await User.findOne({
      email: { $regex: `^${escapedEmail}$`, $options: "i" },
      role: "student",
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found. Make sure the student account is registered first." });
    }

    if (course.students?.some((studentId) => String(studentId) === String(student._id))) {
      return res.status(200).json(await Course.findById(course._id)
        .populate("teacher", "name email")
        .populate("students", "name email rollNo"));
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: student._id } },
      { new: true }
    )
      .populate("teacher", "name email")
      .populate("students", "name email rollNo");

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
