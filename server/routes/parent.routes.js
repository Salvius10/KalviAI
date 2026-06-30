const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const User = require("../models/User.model");
const Course = require("../models/Course.model");
const Submission = require("../models/Submission.model");
const ParentMessage = require("../models/ParentMessage.model");

const toIdString = (value) => String(value);
const normalizeRollNo = (value = "") => String(value).trim().toUpperCase();
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

const teacherOwnsStudent = async (teacherId, studentId) => {
  const course = await Course.findOne({ teacher: teacherId, students: studentId }).select("_id");
  return Boolean(course);
};

router.get("/dashboard", protect, restrictTo("parent"), async (req, res) => {
  try {
    const parent = await User.findById(req.user.id).select("name linkedStudent");
    if (!parent?.linkedStudent) {
      return res.status(404).json({ message: "Linked student not found for this parent account" });
    }

    const student = await User.findById(parent.linkedStudent)
      .select("name email rollNo attendance behaviourNotes")
      .populate("behaviourNotes.teacher", "name email");

    if (!student) {
      return res.status(404).json({ message: "Student record not found" });
    }

    const courses = await Course.find({ students: student._id, isPublished: true })
      .select("title teacher")
      .populate("teacher", "name email");

    const submissions = await Submission.find({ student: student._id })
      .populate({
        path: "assessment",
        select: "title topic difficulty course",
        populate: { path: "course", select: "title" },
      })
      .sort({ submittedAt: -1 });
    const scoredSubmissions = submissions.filter((submission) => (submission.submissionType || "quiz") === "quiz");

    const messages = await ParentMessage.find({ student: student._id })
      .populate("teacher", "name email")
      .sort({ createdAt: 1 });

    const averageScore = scoredSubmissions.length
      ? scoredSubmissions.reduce((sum, submission) => sum + (submission.percentage || 0), 0) / scoredSubmissions.length
      : 0;

    res.json({
      parent: {
        name: parent.name,
      },
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        attendance: student.attendance || { present: 0, absent: 0 },
        behaviourNotes: (student.behaviourNotes || [])
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      },
      progress: {
        totalCourses: courses.length,
        totalAssessments: submissions.length,
        quizCount: scoredSubmissions.length,
        pdfCount: submissions.filter((s) => s.submissionType === "pdf_assignment").length,
        averageScore,
        passCount: scoredSubmissions.filter((s) => s.percentage >= 70).length,
        failCount: scoredSubmissions.filter((s) => s.percentage < 70).length,
        lastUpdated: new Date(),
        recentScores: scoredSubmissions.slice(0, 6).reverse().map((submission, index) => ({
          label: submission.assessment?.title || `Assessment ${index + 1}`,
          score: Math.round(submission.percentage || 0),
        })),
        recentAssessments: submissions.slice(0, 8).map((submission) => ({
          id: submission._id,
          title: submission.assessment?.title || "Assessment",
          courseTitle: submission.assessment?.course?.title || "Assigned course",
          submittedAt: submission.submittedAt || submission.createdAt,
          percentage: Math.round(submission.percentage || 0),
          submissionType: submission.submissionType || "quiz",
        })),
      },
      courses,
      messages,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/teacher/students", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const courses = await Course.find({ teacher: req.user.id })
      .select("title students")
      .populate("students", "name email rollNo attendance behaviourNotes");

    const studentMap = new Map();
    courses.forEach((course) => {
      (course.students || []).forEach((student) => {
        const studentId = toIdString(student._id);
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            id: student._id,
            name: student.name,
            email: student.email,
            rollNo: student.rollNo || "",
            attendance: student.attendance || { present: 0, absent: 0 },
            behaviourNotes: student.behaviourNotes || [],
            courses: [],
          });
        }

        studentMap.get(studentId).courses.push({
          id: course._id,
          title: course.title,
        });
      });
    });

    const students = Array.from(studentMap.values());
    const parentAccounts = await User.find({
      role: "parent",
      linkedStudent: { $in: students.map((student) => student.id) },
    }).select("linkedStudent name");

    const parentMap = new Map(parentAccounts.map((parent) => [toIdString(parent.linkedStudent), parent.name]));

    res.json(
      students.map((student) => ({
        ...student,
        hasParentAccount: parentMap.has(toIdString(student.id)),
        parentName: parentMap.get(toIdString(student.id)) || "",
        latestBehaviourNote: (student.behaviourNotes || [])
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/teacher/students/:studentId/attendance", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!(await teacherOwnsStudent(req.user.id, studentId))) {
      return res.status(403).json({ message: "You can only update attendance for your own students" });
    }

    const present = Number(req.body.present);
    const absent = Number(req.body.absent);

    if (Number.isNaN(present) || Number.isNaN(absent) || present < 0 || absent < 0) {
      return res.status(400).json({ message: "Attendance must be valid non-negative numbers" });
    }

    const student = await User.findOneAndUpdate(
      { _id: studentId, role: "student" },
      { $set: { attendance: { present, absent } } },
      { new: true }
    ).select("name email rollNo attendance behaviourNotes");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/teacher/students/:studentId/behaviour", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const { studentId } = req.params;
    const note = String(req.body.note || "").trim();

    if (!note) {
      return res.status(400).json({ message: "Behaviour note is required" });
    }

    if (!(await teacherOwnsStudent(req.user.id, studentId))) {
      return res.status(403).json({ message: "You can only add notes for your own students" });
    }

    const student = await User.findOneAndUpdate(
      { _id: studentId, role: "student" },
      {
        $push: {
          behaviourNotes: {
            teacher: req.user.id,
            note,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate("behaviourNotes.teacher", "name email");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/messages", protect, async (req, res) => {
  try {
    if (req.user.role === "parent") {
      const parent = await User.findById(req.user.id).select("linkedStudent");
      const messages = await ParentMessage.find({ student: parent?.linkedStudent })
        .populate("teacher", "name email")
        .sort({ createdAt: 1 });
      return res.json(messages);
    }

    if (req.user.role === "teacher") {
      const studentId = String(req.query.studentId || "").trim();
      if (!studentId) {
        return res.status(400).json({ message: "studentId is required" });
      }
      if (!(await teacherOwnsStudent(req.user.id, studentId))) {
        return res.status(403).json({ message: "You can only read messages for your own students" });
      }
      const messages = await ParentMessage.find({ student: studentId, teacher: req.user.id })
        .populate("teacher", "name email")
        .sort({ createdAt: 1 });
      return res.json(messages);
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/messages", protect, restrictTo("teacher", "parent"), async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (req.user.role === "teacher") {
      let student = null;
      const studentId = String(req.body.studentId || "").trim();
      const email = normalizeEmail(req.body.email);
      const rollNo = normalizeRollNo(req.body.rollNo);

      if (studentId) {
        student = await User.findOne({ _id: studentId, role: "student" });
      } else if (email && rollNo) {
        student = await User.findOne({ email, rollNo, role: "student" });
      } else {
        return res.status(400).json({ message: "Provide studentId or both student email and roll number" });
      }

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (!(await teacherOwnsStudent(req.user.id, student._id))) {
        return res.status(403).json({ message: "You can only message parents of your own students" });
      }

      const parent = await User.findOne({ role: "parent", linkedStudent: student._id }).select("_id");
      if (!parent) {
        return res.status(404).json({ message: "Parent account has not been created for this student yet" });
      }

      const created = await ParentMessage.create({
        student: student._id,
        teacher: req.user.id,
        senderRole: "teacher",
        message,
      });

      const populated = await ParentMessage.findById(created._id).populate("teacher", "name email");
      return res.status(201).json(populated);
    }

    const parent = await User.findById(req.user.id).select("linkedStudent");
    if (!parent?.linkedStudent) {
      return res.status(404).json({ message: "Linked student not found" });
    }

    let teacherId = String(req.body.teacherId || "").trim();
    if (!teacherId) {
      const latestTeacherMessage = await ParentMessage.findOne({
        student: parent.linkedStudent,
        senderRole: "teacher",
      })
        .sort({ createdAt: -1 })
        .select("teacher");
      teacherId = latestTeacherMessage?.teacher ? toIdString(latestTeacherMessage.teacher) : "";
    }

    if (!teacherId) {
      const course = await Course.findOne({ students: parent.linkedStudent }).select("teacher");
      teacherId = course?.teacher ? toIdString(course.teacher) : "";
    }

    if (!teacherId) {
      return res.status(400).json({ message: "No teacher is linked to this student yet" });
    }

    const created = await ParentMessage.create({
      student: parent.linkedStudent,
      teacher: teacherId,
      senderRole: "parent",
      message,
    });

    const populated = await ParentMessage.findById(created._id).populate("teacher", "name email");
    return res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
