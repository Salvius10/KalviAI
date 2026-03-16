const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const AITutor = require("../models/AITutor.model");
const axios = require("axios");
// Handle potential default export issue with pdf-parse
const parsePdf = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;

const MAX_DOC_CHARS = 12000;

const toSafeString = (value) => (typeof value === "string" ? value.trim() : "");

const parseMessages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const clampAttempt = (attemptValue) => {
  const parsed = Number(attemptValue);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(1, Math.min(3, Math.trunc(parsed)));
};

const detectComplexity = (question = "", documentText = "") => {
  const combined = `${question} ${documentText}`.toLowerCase();
  const tokenCount = combined.split(/\s+/).filter(Boolean).length;
  const advancedKeywords = [
    "prove",
    "derivation",
    "optimize",
    "dynamic programming",
    "complexity",
    "integral",
    "theorem",
    "architecture",
    "distributed",
    "compiler",
    "gradient",
    "probability",
  ];

  const hasAdvancedKeywords = advancedKeywords.some((keyword) =>
    combined.includes(keyword)
  );

  if (tokenCount > 200 || hasAdvancedKeywords) return "hard";
  if (tokenCount > 70) return "medium";
  return "easy";
};

const getStageInstruction = (attempt, complexity) => {
  if (attempt >= 3) {
    return "Provide a complete explanation and a clear final solution. Include concise reasoning steps, and end with a short summary.";
  }

  if (complexity === "hard") {
    return "Give only strategic hints, not the final answer. Break the hint into 3 short bullets that guide decomposition and next steps.";
  }

  if (complexity === "medium") {
    return "Give only guided hints, not the final answer. Provide 2 to 3 short hints and one checkpoint question for the student.";
  }

  return "Give a simple scaffold hint only, not the final answer. Keep it short and encourage the student to attempt first.";
};

const extractDocumentText = async (file) => {
  if (!file) {
    return { text: "", fileName: "", fileType: "" };
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  const mimeType = file.mimetype || "";

  if (mimeType.includes("pdf") || extension === ".pdf") {
    const parsed = await parsePdf(file.buffer);
    return {
      text: (parsed.text || "").slice(0, MAX_DOC_CHARS),
      fileName: file.originalname,
      fileType: "pdf",
    };
  }

  if (
    mimeType.includes("wordprocessingml") ||
    extension === ".docx" ||
    extension === ".doc"
  ) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      text: (parsed.value || "").slice(0, MAX_DOC_CHARS),
      fileName: file.originalname,
      fileType: extension.replace(".", "") || "word",
    };
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or DOC.");
};

const callGroqTutor = async ({ question, messages, attempt, complexity, documentText }) => {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const apiKey = process.env.GROQ_API_KEY;
  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in server environment variables.");
  }

  const historyMessages = messages
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: toSafeString(item.content),
    }))
    .filter((item) => item.content);

  const stageInstruction = getStageInstruction(attempt, complexity);

  const systemPrompt = [
    "You are a kalvi AI tutor.",
    "Policy:",
    "- Attempt 1 and 2: hints only, no direct final solution.",
    "- Attempt 3: full explanation and complete solution.",
    "- Keep response educational and concise.",
    `Current attempt: ${attempt}`,
    `Problem complexity: ${complexity}`,
    `Instruction: ${stageInstruction}`,
  ].join("\n");

  const documentContext = documentText
    ? `\n\nDocument context (reference this when relevant):\n${documentText}`
    : "";

  const requestMessages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    {
      role: "user",
      content: `Question: ${question}${documentContext}`,
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: requestMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content ||
    "I couldn't generate a response right now. Please try again.";

  return content;
};

exports.tutor = async (req, res) => {
  try {
    const studentId = req.user._id;
    const question = toSafeString(req.body.question);
    const messages = parseMessages(req.body.messages);
    const attempt = clampAttempt(req.body.attemptCount);

    console.log("📝 Tutor Request:", {
      studentId,
      question,
      messagesCount: messages.length,
      attempt,
      hasFile: !!req.file,
    });

    if (!question) {
      return res.status(400).json({ message: "Question is required." });
    }

    const { text: documentText, fileName, fileType } = await extractDocumentText(req.file);
    const complexity = detectComplexity(question, documentText);

    const reply = await callGroqTutor({
      question,
      messages,
      attempt,
      complexity,
      documentText,
    });

    // Save to database
    const username = req.user.name || "Student";
    
    // Create messages with consistent structure
    const userMessage = {
      role: "user",
      content: question,
      username: username
    };
    const assistantMessage = {
      role: "assistant",
      content: reply,
      username: "AI Tutor"
    };
    
    try {
      console.log("💾 Saving to database...");
      const updateResult = await AITutor.findOneAndUpdate(
        { student: studentId },
        {
          $push: {
            messages: {
              $each: [userMessage, assistantMessage],
            },
          },
          $set: {
            lastQuestion: question,
            attemptCount: attempt,
            stage: attempt >= 3 ? "solution" : "hint",
            complexity,
            documentUploaded: !!fileName,
            documentName: fileName || "",
          },
        },
        { upsert: true, new: true }
      );
      console.log("✅ Saved! Messages count:", updateResult.messages.length);
    } catch (dbError) {
      console.error("⚠️ Database error:", dbError.message);
      console.error("Stack:", dbError.stack);
    }

    return res.status(200).json({
      reply,
      attempt,
      stage: attempt >= 3 ? "solution" : "hint",
      complexity,
      attachment: fileName
        ? {
            fileName,
            fileType,
          }
        : null,
    });
  } catch (err) {
    console.error("❌ AI Tutor error:", err.message);
    console.error("Stack:", err.stack);
    return res.status(500).json({ message: err.message || "Failed to generate AI tutor response." });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const studentId = req.user._id;
    console.log("📖 Loading chat history for student:", studentId);
    
    const chatHistory = await AITutor.findOne({ student: studentId })
      .populate("student", "name email role")
      .select("messages lastQuestion attemptCount stage complexity updatedAt")
      .lean();

    if (!chatHistory) {
      console.log("ℹ️ No chat history found, returning empty");
      return res.status(200).json({
        messages: [],
        lastQuestion: "",
        attemptCount: 0,
        stage: "hint",
      });
    }

    console.log("✅ Chat history loaded. Messages:", chatHistory.messages?.length);
    return res.status(200).json(chatHistory);
  } catch (err) {
    console.error("❌ Get chat history error:", err);
    return res.status(500).json({ message: "Failed to retrieve chat history." });
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    const studentId = req.user._id;
    
    await AITutor.findOneAndDelete({ student: studentId });

    return res.status(200).json({ message: "Chat history cleared successfully." });
  } catch (err) {
    console.error("Clear chat history error:", err);
    return res.status(500).json({ message: "Failed to clear chat history." });
  }
};

exports.generateAssessment = async (req, res) => {
  try {

    const response = await axios.post(
      "http://127.0.0.1:8000/quiz/generate",
      req.body
    );

    res.json(response.data);

  } catch (error) {
    console.error("Python AI error:", error.message);
    res.status(500).json({ message: "Assessment generation failed" });
  }
};

exports.generateFlashcards = async (req, res) => {
  res.json({ message: "⚠️ AI Flashcard Generator — to be implemented" });
};

exports.detectPlagiarism = async (req, res) => {
  res.json({ message: "⚠️ Plagiarism Detector — to be implemented" });
};