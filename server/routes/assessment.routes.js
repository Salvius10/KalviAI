const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Assessment = require("../models/Assessment.model");
const Course = require("../models/Course.model");

const getAssignedCourseIds = async (studentId) => {
  const courses = await Course.find({ isPublished: true, students: studentId }).select("_id");
  return courses.map((course) => course._id);
};

const normalizeAssessmentType = (assessment = {}) => {
  if (assessment?.assessmentType === "pdf_assignment") return "pdf_assignment";
  if ((assessment?.instructions || "").trim() && (!Array.isArray(assessment?.questions) || assessment.questions.length === 0)) {
    return "pdf_assignment";
  }
  return "quiz";
};

const sanitizeAssessmentForStudent = (assessment) => {
  const doc = typeof assessment?.toObject === "function" ? assessment.toObject() : assessment;
  if (!doc) return doc;
  const assessmentType = normalizeAssessmentType(doc);

  return {
    ...doc,
    assessmentType,
    instructions: doc.instructions || "",
    questions: Array.isArray(doc.questions)
      ? doc.questions.map((q) => ({
          _id: q._id,
          questionText: q.questionText,
          type: q.type,
          options: q.options,
          marks: q.marks,
        }))
      : [],
  };
};

// GET assessments for a specific course
router.get("/course/:courseId", protect, async (req, res) => {
  try {
    const filter = { course: req.params.courseId };
    if (req.user.role !== "teacher") {
      const course = await Course.findOne({
        _id: req.params.courseId,
        isPublished: true,
        students: req.user.id,
      }).select("_id");
      if (!course) {
        return res.json([]);
      }
      filter.isPublished = true;
    } else {
      const course = await Course.findOne({ _id: req.params.courseId, teacher: req.user.id }).select("_id");
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
    }

    const assessments = await Assessment.find(filter).populate("course", "title");
    if (req.user.role !== "teacher") {
      return res.json(assessments.map(sanitizeAssessmentForStudent));
    }

    res.json(assessments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET all assessments for student (from all published courses)
router.get("/student/all", protect, restrictTo("student"), async (req, res) => {
  try {
    const courseIds = await getAssignedCourseIds(req.user.id);
    const assessments = await Assessment.find({
      course: { $in: courseIds },
      isPublished: true,
    }).populate("course", "title");
    res.json(assessments.map(sanitizeAssessmentForStudent));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id).populate("course", "title teacher isPublished students");
    if (!assessment) return res.status(404).json({ message: "Not found" });
    if (req.user.role === "student") {
      const isAssigned =
        assessment.isPublished &&
        assessment.course?.isPublished &&
        Array.isArray(assessment.course?.students) &&
        assessment.course.students.some((studentId) => String(studentId) === String(req.user.id));

      if (!isAssigned) {
        return res.status(403).json({ message: "Assessment is not assigned to this student." });
      }
      return res.json(sanitizeAssessmentForStudent(assessment));
    }

    if (String(assessment.teacher) !== String(req.user.id)) {
      return res.status(403).json({ message: "You do not have permission to view this assessment." });
    }
    res.json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.body.course, teacher: req.user.id }).select("_id");
    if (!course) {
      return res.status(403).json({ message: "You can only create assessments for your own courses." });
    }
    const assessmentType = normalizeAssessmentType(req.body);
    if (assessmentType === "quiz" && (!Array.isArray(req.body.questions) || req.body.questions.length === 0)) {
      return res.status(400).json({ message: "Quiz assessments require at least one question." });
    }
    const assessment = await Assessment.create({
      ...req.body,
      teacher: req.user.id,
      assessmentType,
      questions: assessmentType === "quiz" ? (req.body.questions || []) : [],
      duration: assessmentType === "quiz" ? req.body.duration : 0,
    });
    res.status(201).json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const existing = await Assessment.findOne({ _id: req.params.id, teacher: req.user.id }).select("_id");
    if (!existing) {
      return res.status(404).json({ message: "Assessment not found" });
    }
    if (req.body.course) {
      const course = await Course.findOne({ _id: req.body.course, teacher: req.user.id }).select("_id");
      if (!course) {
        return res.status(403).json({ message: "You can only assign assessments to your own courses." });
      }
    }
    const assessmentType = normalizeAssessmentType(req.body);
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        assessmentType,
        questions: assessmentType === "quiz" ? (req.body.questions || []) : [],
        duration: assessmentType === "quiz" ? req.body.duration : 0,
      },
      { new: true }
    );
    res.json(assessment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const assessment = await Assessment.findOneAndDelete({ _id: req.params.id, teacher: req.user.id });
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }
    res.json({ message: "Assessment deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
