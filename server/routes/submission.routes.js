const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { createCanvas } = require("canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth.middleware");
const Submission = require("../models/Submission.model");
const Assessment = require("../models/Assessment.model");
const Course = require("../models/Course.model");

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

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

const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (file.mimetype === "application/pdf" || ext === ".pdf") return cb(null, true);
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype) || ALLOWED_IMAGE_EXTS.has(ext)) return cb(null, true);
    cb(new Error("Only PDF or image files (JPG, PNG, WEBP) are allowed."));
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

const MIN_IMAGE_TEXT_LENGTH = 20;
const MIN_PDF_TEXT_LENGTH = 50;

const extractPdfText = async (filePath) => {
  const data = new Uint8Array(readFileBuffer(filePath));
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    disableWorker: true,
    verbosity: 0,
  }).promise;

  let text = "";
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    try {
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str || "").join(" ") + "\n";
    } finally {
      page.cleanup();
    }
  }

  return { text, numpages: pdfDoc.numPages };
};

const IMAGE_MIME_MAP = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

const convertPdfPagesToImages = async (filePath) => {
  const data = new Uint8Array(readFileBuffer(filePath));
  const factory = new NodeCanvasFactory();
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    canvasFactory: factory,
    disableWorker: true,
    verbosity: 0,
  }).promise;

  const images = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvasAndContext = factory.create(Math.floor(viewport.width), Math.floor(viewport.height));

    try {
      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory: factory,
      }).promise;

      images.push({
        pageNum,
        mimeType: "image/jpeg",
        base64: canvasAndContext.canvas.toBuffer("image/jpeg", { quality: 0.85 }).toString("base64"),
      });
    } finally {
      factory.destroy(canvasAndContext);
      page.cleanup();
    }
  }

  return images;
};

const extractTextFromImageBase64 = async ({ base64, mimeType, pageLabel = "image" }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured for handwritten assignment OCR.");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 4000,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: "text", text: `Transcribe ALL text visible in this handwritten assignment ${pageLabel}. Return only the transcribed text, exactly as written. Do not summarise or add anything.` },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Vision OCR error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
};

const extractTextFromImage = async (filePath) => {
  const imageBuffer = readFileBuffer(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME_MAP[ext] || "image/jpeg";
  return extractTextFromImageBase64({
    base64: imageBuffer.toString("base64"),
    mimeType,
    pageLabel: "image",
  });
};

const extractTextFromScannedPdf = async (filePath) => {
  const pageImages = await convertPdfPagesToImages(filePath);
  const pageTexts = [];

  for (const image of pageImages) {
    const pageText = await extractTextFromImageBase64({
      base64: image.base64,
      mimeType: image.mimeType,
      pageLabel: `page ${image.pageNum}`,
    });
    pageTexts.push(`Page ${image.pageNum}\n${pageText}`);
  }

  return pageTexts.join("\n\n");
};

const isImageFile = (multerFile) => {
  if (!multerFile) return false;
  if (ALLOWED_IMAGE_MIMES.has(multerFile.mimetype)) return true;
  const ext = path.extname(multerFile.originalname || multerFile.path || "").toLowerCase();
  return ALLOWED_IMAGE_EXTS.has(ext);
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
      return res.status(400).json({ message: "This assessment is not a PDF/assignment upload." });
    }

    if (isPastDue(assessment)) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "The deadline has passed. Late submissions are not allowed." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Upload a PDF or an image of your handwritten assignment." });
    }

    const existingSubmission = await Submission.findOne({ assessment: assessmentId, student: req.user.id }).select("_id fileUrl");
    if (existingSubmission) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ message: "You have already submitted this assignment." });
    }

    const uploadedFile = readFileBuffer(req.file.path);
    const fileHash = createFileHash(uploadedFile);
    const fileIsImage = isImageFile(req.file);
    const submissionType = fileIsImage ? "image_assignment" : "pdf_assignment";

    let rawText = "";
    if (fileIsImage) {
      rawText = await extractTextFromImage(req.file.path);
    } else {
      const parsed = await extractPdfText(req.file.path);
      rawText = parsed?.text || "";

      if (normalizeText(rawText).length < MIN_PDF_TEXT_LENGTH) {
        rawText = await extractTextFromScannedPdf(req.file.path);
      }
    }

    const extractedText = normalizeText(rawText);
    const minLength = fileIsImage ? MIN_IMAGE_TEXT_LENGTH : MIN_PDF_TEXT_LENGTH;
    if (!extractedText || extractedText.length < minLength) {
      cleanupUploadedFile(req.file?.path);
      const hint = fileIsImage
        ? "Could not read enough text from the image. Make sure the handwriting is clear, well-lit, and the photo is in focus."
        : "The uploaded PDF does not contain enough readable text.";
      return res.status(400).json({ message: hint });
    }

    const otherSubmissions = await Submission.find({
      assessment: assessmentId,
      submissionType: { $in: ["pdf_assignment", "image_assignment"] },
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
        message: `Submission rejected. Your assignment is too similar to work already submitted by ${highestMatch.studentName}.`,
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
      submissionType,
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

    if (!["pdf_assignment", "image_assignment"].includes(submission.submissionType)) {
      return res.status(400).json({ message: "Only assignment submissions can be deleted here." });
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
