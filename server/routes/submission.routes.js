const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Submission = require("../models/Submission.model");
const Assessment = require("../models/Assessment.model");
const Course = require("../models/Course.model");

const parsePdf = typeof pdfParse === "function" ? pdfParse : pdfParse?.default;
const PDFParse = pdfParse?.PDFParse;
const uploadsDir = path.join(__dirname, "../uploads/submissions");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (file.mimetype === "application/pdf" || ext === ".pdf") {
      return cb(null, true);
    }
    cb(new Error("Only PDF files are allowed."));
  },
});

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value = "") =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);

const calculateSimilarityScore = (sourceText, targetText) => {
  const sourceTokens = new Set(tokenize(sourceText));
  const targetTokens = new Set(tokenize(targetText));

  if (sourceTokens.size === 0 || targetTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  sourceTokens.forEach((token) => {
    if (targetTokens.has(token)) overlap += 1;
  });

  return Math.round((overlap / Math.max(sourceTokens.size, targetTokens.size)) * 100);
};

const ensureAssignedAssessment = async (assessmentId, studentId) => {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) return { error: { status: 404, message: "Assessment not found" } };

  const course = await Course.findOne({
    _id: assessment.course,
    isPublished: true,
    students: studentId,
  }).select("_id");

  if (!assessment.isPublished || !course) {
    return { error: { status: 403, message: "Assessment is not assigned to this student." } };
  }

  return { assessment };
};

const isPastDue = (assessment) => {
  if (!assessment?.dueDate) return false;
  return new Date(assessment.dueDate).getTime() < Date.now();
};

const cleanupUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_err) {
      // Best-effort cleanup for rejected uploads.
    }
  }
};

const readFileBuffer = (filePath) => fs.readFileSync(filePath);

const createFileHash = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const extractPdfText = async (filePath) => {
  const data = readFileBuffer(filePath);

  if (typeof parsePdf === "function") {
    return parsePdf(data);
  }

  if (typeof PDFParse === "function") {
    const parser = new PDFParse({ data });
    try {
      return await parser.getText();
    } finally {
      await parser.destroy?.();
    }
  }

  throw new Error("PDF parser is not configured correctly.");
};

// Submit a quiz assessment
router.post("/", protect, restrictTo("student"), async (req, res) => {
  try {
    const { assessmentId, answers } = req.body;
    const { assessment, error } = await ensureAssignedAssessment(assessmentId, req.user.id);
    if (error) return res.status(error.status).json({ message: error.message });

    if ((assessment.assessmentType || "quiz") !== "quiz") {
      return res.status(400).json({ message: "This assessment requires PDF upload submission." });
    }

    if (isPastDue(assessment)) {
      return res.status(400).json({ message: "The submission deadline has passed for this assessment." });
    }

    const existingSubmission = await Submission.findOne({ assessment: assessmentId, student: req.user.id }).select("_id");
    if (existingSubmission) {
      return res.status(400).json({ message: "You have already submitted this assessment." });
    }

    let totalScore = 0;
    const maxScore = assessment.questions.reduce((sum, q) => sum + q.marks, 0);

    const gradedAnswers = assessment.questions.map((q, i) => {
      const studentAnswer = answers[i]?.studentAnswer || "";
      const isCorrect = q.type !== "descriptive" && studentAnswer.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
      const marksAwarded = isCorrect ? q.marks : 0;
      totalScore += marksAwarded;
      return { question: q._id, studentAnswer, isCorrect, marksAwarded };
    });

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    const submission = await Submission.create({
      assessment: assessmentId,
      student: req.user.id,
      submissionType: "quiz",
      answers: gradedAnswers,
      totalScore,
      maxScore,
      percentage,
    });

    // Include full question review so student can see correct answers immediately
    const reviewedAnswers = assessment.questions.map((q, i) => ({
      questionText: q.questionText,
      questionType: q.type,
      options: q.options || [],
      correctAnswer: q.correctAnswer || "",
      studentAnswer: gradedAnswers[i]?.studentAnswer || "",
      isCorrect: Boolean(gradedAnswers[i]?.isCorrect),
      marks: q.marks,
      marksAwarded: gradedAnswers[i]?.marksAwarded || 0,
    }));

    res.status(201).json({ ...submission.toObject(), reviewedAnswers });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Submit a PDF assignment
router.post("/upload", protect, restrictTo("student"), upload.single("file"), async (req, res) => {
  try {
    const assessmentId = String(req.body.assessmentId || "").trim();
    const { assessment, error } = await ensureAssignedAssessment(assessmentId, req.user.id);
    if (error) {
      cleanupUploadedFile(req.file?.path);
      return res.status(error.status).json({ message: error.message });
    }

    if ((assessment.assessmentType || "quiz") !== "pdf_assignment") {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "This assessment is not a PDF assignment." });
    }

    if (isPastDue(assessment)) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "The deadline has passed. Late PDF submissions are not allowed." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Upload a PDF file to submit this assignment." });
    }

    const existingSubmission = await Submission.findOne({ assessment: assessmentId, student: req.user.id }).select("_id fileUrl");
    if (existingSubmission) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "You have already submitted this assignment." });
    }

    const uploadedFile = readFileBuffer(req.file.path);
    const fileHash = createFileHash(uploadedFile);

    const parsed = await extractPdfText(req.file.path);
    const extractedText = normalizeText(parsed?.text || "");
    if (!extractedText || extractedText.length < 50) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "The uploaded PDF does not contain enough readable text." });
    }

    const otherSubmissions = await Submission.find({
      assessment: assessmentId,
      submissionType: "pdf_assignment",
    }).populate("student", "name email");

    let highestMatch = { score: 0, studentName: "", studentId: "" };
    otherSubmissions.forEach((submission) => {
      if (submission.fileHash && submission.fileHash === fileHash) {
        highestMatch = {
          score: 100,
          studentName: submission.student?.name || "Another student",
          studentId: String(submission.student?._id || ""),
        };
        return;
      }

      const score = calculateSimilarityScore(extractedText, submission.extractedText || "");
      if (score > highestMatch.score) {
        highestMatch = {
          score,
          studentName: submission.student?.name || "Another student",
          studentId: String(submission.student?._id || ""),
        };
      }
    });

    if (highestMatch.score >= 80) {
      cleanupUploadedFile(req.file?.path);
      return res.status(409).json({
        message: `Submission rejected. The PDF is too similar to work already submitted by ${highestMatch.studentName}.`,
        plagiarismScore: highestMatch.score,
      });
    }

    const plagiarismFlag = highestMatch.score >= 60;
    const plagiarismReport = highestMatch.score
      ? `Closest match: ${highestMatch.studentName} (${highestMatch.score}% similarity).`
      : "No strong similarity detected.";

    const submission = await Submission.create({
      assessment: assessmentId,
      student: req.user.id,
      submissionType: "pdf_assignment",
      fileUrl: `/uploads/submissions/${path.basename(req.file.path)}`,
      fileName: req.file.originalname,
      fileHash,
      extractedText,
      totalScore: 0,
      maxScore: 0,
      percentage: 0,
      plagiarismScore: highestMatch.score,
      plagiarismFlag,
      plagiarismReport,
    });

    res.status(201).json(submission);
  } catch (err) {
    cleanupUploadedFile(req.file?.path);
    res.status(500).json({ message: err.message });
  }
});

// Get submissions for a student
router.get("/my", protect, restrictTo("student"), async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate("assessment", "title course assessmentType dueDate");
    res.json(submissions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a student's own submission so they can upload again
router.delete("/:submissionId", protect, restrictTo("student"), async (req, res) => {
  try {
    const submission = await Submission.findOne({
      _id: req.params.submissionId,
      student: req.user.id,
    }).populate("assessment", "dueDate");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (submission.submissionType !== "pdf_assignment") {
      return res.status(400).json({ message: "Only PDF assignment submissions can be deleted here." });
    }

    if (isPastDue(submission.assessment)) {
      return res.status(400).json({ message: "You cannot delete the submission after the deadline has passed." });
    }

    if (submission.fileUrl) {
      const filePath = path.join(__dirname, "../", submission.fileUrl);
      cleanupUploadedFile(filePath);
    }

    await Submission.deleteOne({ _id: submission._id });
    res.json({ message: "Submission deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all submissions for an assessment (teacher)
router.get("/assessment/:assessmentId", protect, restrictTo("teacher"), async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const questionMap = new Map(
      (assessment.questions || []).map((q) => [String(q._id), q])
    );

    const submissions = await Submission.find({ assessment: req.params.assessmentId })
      .populate("student", "name email rollNo");

    const detailed = submissions.map((sub) => ({
      ...sub.toObject(),
      reviewedAnswers: (sub.answers || []).map((answer) => {
        const q = questionMap.get(String(answer.question));
        return {
          questionId: answer.question,
          questionText: q?.questionText || "Question",
          questionType: q?.type || "mcq",
          options: q?.options || [],
          correctAnswer: q?.correctAnswer || "",
          studentAnswer: answer.studentAnswer || "",
          isCorrect: Boolean(answer.isCorrect),
          marksAwarded: answer.marksAwarded || 0,
          marks: q?.marks || 1,
        };
      }),
    }));

    res.json(detailed);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
