const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const mammoth = require("mammoth");
const AITutor = require("../models/AITutor.model");
const axios = require("axios");
const { createCanvas } = require("canvas");
// pdfjs-dist v2 — handles both text extraction and page-to-image rendering
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc = false; // disable worker in Node.js

const MAX_DOC_CHARS = 12000;
const MAX_QUIZ_DOC_CHARS = 10000;
const MIN_AI_QUIZ_QUESTIONS = 5;
const MAX_AI_QUIZ_QUESTIONS = 10;
const QUIZ_RETRY_CONFIGS = [
  { materialChars: 10000, maxTokens: 2800, questionCap: 10, useResponseFormat: true },
  { materialChars: 6000,  maxTokens: 2200, questionCap: 10, useResponseFormat: true },
  { materialChars: 3500,  maxTokens: 1600, questionCap: 7,  useResponseFormat: false },
  { materialChars: 2000,  maxTokens: 1200, questionCap: 5,  useResponseFormat: false },
];

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
    return "Provide a complete explanation and a clear final solution. Use short sections with plain text headings, bullet points or numbered steps where useful, and end with a short summary. Do not compress everything into one paragraph.";
  }

  if (complexity === "hard") {
    return "Give only strategic hints, not the final answer. Break the hint into 3 short bullets that guide decomposition and next steps.";
  }

  if (complexity === "medium") {
    return "Give only guided hints, not the final answer. Provide 2 to 3 short hints and one checkpoint question for the student.";
  }

  return "Give a simple scaffold hint only, not the final answer. Keep it short and encourage the student to attempt first.";
};

const decodeXmlEntities = (value = "") =>
  String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\n")
    .replace(/&#xA;/gi, "\n")
    .replace(/&#xD;/gi, "\n");

const extractPptxTextFromBuffer = (buffer, originalName = "slides.pptx") => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kalviai-pptx-"));
  const tempFile = path.join(tempDir, originalName.replace(/[^\w.-]/g, "_"));

  try {
    fs.writeFileSync(tempFile, buffer);

    const archiveEntries = execFileSync("unzip", ["-Z1", tempFile], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    })
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (!archiveEntries.length) {
      return "";
    }

    const slideText = archiveEntries.map((entry) => {
      const xml = execFileSync("unzip", ["-p", tempFile, entry], {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 8,
      });

      return decodeXmlEntities(xml)
        .replace(/<a:br\s*\/>/gi, "\n")
        .replace(/<\/a:p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    });

    return slideText.filter(Boolean).join("\n\n").slice(0, MAX_DOC_CHARS);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup failures.
    }
  }
};

const extractDocumentText = async (file) => {
  if (!file) {
    return { text: "", fileName: "", fileType: "" };
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  const mimeType = file.mimetype || "";

  if (mimeType.includes("pdf") || extension === ".pdf") {
    try {
      console.log("🔍 Extracting PDF text:", { fileName: file.originalname, bufferSize: file.buffer.length });
      const extractedText = await extractPdfTextWithPdfjs(file.buffer);
      console.log("✅ PDF text extracted:", { textLength: extractedText.length, preview: extractedText.slice(0, 200) });

      if (!extractedText.trim()) {
        throw new Error("This PDF is scanned/image-based — no text layer found. Groq Vision will handle it.");
      }

      return { text: extractedText, fileName: file.originalname, fileType: "pdf" };
    } catch (pdfError) {
      console.error("❌ PDF text extraction error:", pdfError.message);
      throw pdfError;
    }
  }

  if (
    mimeType.includes("wordprocessingml") ||
    extension === ".docx" ||
    extension === ".doc"
  ) {
    try {
      console.log("🔍 Starting DOCX parsing:", { fileName: file.originalname });
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      const extractedText = (parsed.value || "").slice(0, MAX_DOC_CHARS);

      console.log("✅ DOCX parsed successfully:", {
        fileName: file.originalname,
        textLength: extractedText.length,
        preview: extractedText.slice(0, 200),
      });

      if (!extractedText.trim()) {
        throw new Error("Word document appears to be empty or contains no extractable text.");
      }

      return { text: extractedText, fileName: file.originalname, fileType: extension.replace(".", "") || "word" };
    } catch (docxError) {
      console.error("❌ DOCX parsing error:", docxError.message);
      throw docxError;
    }
  }

  if (
    mimeType.includes("presentationml") ||
    mimeType.includes("powerpoint") ||
    extension === ".pptx"
  ) {
    console.log("🔍 Starting PPTX parsing:", { fileName: file.originalname });
    const extractedText = extractPptxTextFromBuffer(file.buffer, file.originalname);
    console.log("✅ PPTX parsed:", { textLength: extractedText.length, preview: extractedText.slice(0, 200) });
    return { text: extractedText, fileName: file.originalname, fileType: "pptx" };
  }

  if (extension === ".ppt") {
    return {
      text: toSafeString(file.buffer?.toString("latin1") || "").slice(0, MAX_DOC_CHARS),
      fileName: file.originalname,
      fileType: "ppt",
    };
  }

  if (mimeType.includes("text/plain") || extension === ".txt" || extension === ".md") {
    const extractedText = toSafeString(file.buffer?.toString("utf-8") || "").slice(0, MAX_DOC_CHARS);
    console.log("✅ TXT parsed:", { textLength: extractedText.length, preview: extractedText.slice(0, 200) });
    return { text: extractedText, fileName: file.originalname, fileType: extension.replace(".", "") || "txt" };
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, PPTX, or TXT.");
};

const parseQuizJson = (content = "") => {
  const jsonPayload = extractJsonPayload(content);
  if (!jsonPayload) return null;

  try {
    return JSON.parse(jsonPayload);
  } catch {
    const repaired = repairLikelyJson(jsonPayload);

    try {
      return JSON.parse(repaired);
    } catch {
      return extractQuestionObjectsFromText(repaired);
    }
  }
};

const repairLikelyJson = (raw = "") =>
  toSafeString(raw)
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");

const extractJsonPayload = (rawContent = "") => {
  const direct = toSafeString(rawContent);
  if (!direct) return null;

  const fenceMatch = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : direct;

  const firstBracket = candidate.indexOf("[");
  const lastBracket = candidate.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return candidate.slice(firstBracket, lastBracket + 1);
  }

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }

  return candidate;
};

const extractQuestionObjectsFromText = (rawContent = "") => {
  const direct = toSafeString(rawContent);
  if (!direct) return null;

  const objectMatches = direct.match(/\{[\s\S]*?\}/g);
  if (!objectMatches?.length) return null;

  const parsedObjects = objectMatches
    .map((chunk) => {
      try {
        return JSON.parse(repairLikelyJson(chunk));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return parsedObjects.length ? parsedObjects : null;
};

const normalizeGeneratedQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((q) => {
      const options = Array.isArray(q?.options)
        ? q.options.map((opt) => toSafeString(opt)).filter(Boolean)
        : [];

      const questionText = toSafeString(q?.questionText || q?.question || q?.text);
      const correctAnswer = toSafeString(
        q?.correctAnswer ||
        q?.answer ||
        q?.correct_option ||
        (Number.isInteger(q?.correctOptionIndex) ? options[q.correctOptionIndex] : "")
      );
      const marks = Number(q?.marks);

      return {
        questionText,
        type: "mcq",
        options,
        correctAnswer,
        marks: Number.isFinite(marks) && marks > 0 ? Math.trunc(marks) : 1,
      };
    })
    .filter((q) => q.questionText && q.options.length >= 2 && q.correctAnswer);
};

const saveQuizMaterialFile = (file) => {
  if (!file) return null;
  try {
    const dir = path.join(__dirname, "..", "uploads", "quiz-materials");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname || "").toLowerCase() || ".pdf";
    const safeName = (file.originalname || "material")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 60);
    const uniqueName = `${Date.now()}-${safeName}`;
    fs.writeFileSync(path.join(dir, uniqueName), file.buffer);
    return {
      fileName: file.originalname || uniqueName,
      fileType: ext.replace(".", ""),
      url: `/uploads/quiz-materials/${uniqueName}`,
    };
  } catch {
    return null;
  }
};

const extractStudyMaterialText = async (file, fallbackText = "") => {
  const normalizeMaterial = (value = "") =>
    toSafeString(
      (() => {
        try {
          return String(value || "").normalize("NFKC");
        } catch {
          return String(value || "");
        }
      })()
    )
      .replace(/[^\S\r\n\t]+/g, " ")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .slice(0, MAX_QUIZ_DOC_CHARS);

  if (file) {
    try {
      const parsed = await extractDocumentText(file);
      return normalizeMaterial(parsed.text);
    } catch {
      // Last-resort fallback: treat unknown formats as plain text.
      return normalizeMaterial(file.buffer?.toString("utf-8") || "");
    }
  }

  return normalizeMaterial(fallbackText);
};

const buildQuizMaterialExcerpt = (studyMaterial = "", limit = MAX_QUIZ_DOC_CHARS) => {
  const normalized = toSafeString(studyMaterial);
  if (!normalized) return "";

  if (normalized.length <= limit) {
    return normalized;
  }

  const paragraphs = normalized
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return normalized.slice(0, limit);
  }

  let excerpt = "";

  for (const paragraph of paragraphs) {
    const next = excerpt ? `${excerpt}\n\n${paragraph}` : paragraph;
    if (next.length > limit) break;
    excerpt = next;
  }

  return excerpt || normalized.slice(0, limit);
};

const shuffleList = (items = []) => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const extractSentenceCandidates = (studyMaterial = "") => {
  const normalized = toSafeString(studyMaterial)
    .replace(/\s+/g, " ")
    .replace(/\.\s+/g, ".\n");

  return normalized
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 220)
    .filter((sentence, index, all) => all.indexOf(sentence) === index);
};

const buildFallbackQuestions = (studyMaterial = "", requestedCount = 5, topic = "") => {
  const sentences = extractSentenceCandidates(studyMaterial);
  if (sentences.length < 4) return [];

  const predicateCandidates = sentences
    .map((sentence) => {
      const match = sentence.match(/^(.{3,80}?)\s+(is|are|refers to|means)\s+(.+)$/i);
      if (!match) return null;

      const subject = toSafeString(match[1]).replace(/[:,-]+$/, "");
      const predicate = toSafeString(match[3]).replace(/[.]+$/, "");
      if (!subject || !predicate) return null;
      if (subject.split(/\s+/).length > 8) return null;

      return { subject, predicate, sentence };
    })
    .filter(Boolean);

  const usableCandidates = predicateCandidates.length >= 4
    ? predicateCandidates
    : sentences.map((sentence, index) => ({
        subject: topic || `concept ${index + 1}`,
        predicate: sentence.replace(/[.]+$/, ""),
        sentence,
      }));

  const questions = [];

  for (const candidate of usableCandidates) {
    const distractors = shuffleList(
      usableCandidates
        .filter((item) => item.predicate !== candidate.predicate)
        .map((item) => item.predicate)
        .filter(Boolean)
    )
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 3);

    if (distractors.length < 3) continue;

    const correctAnswer = candidate.predicate;
    const options = shuffleList([correctAnswer, ...distractors]);
    const questionText = predicateCandidates.length >= 4
      ? `What best describes ${candidate.subject}?`
      : `Which statement is supported by the study material${topic ? ` about ${topic}` : ""}?`;

    questions.push({
      questionText,
      type: "mcq",
      options,
      correctAnswer,
      marks: 1,
    });

    if (questions.length >= requestedCount) {
      break;
    }
  }

  return questions;
};

const parseProviderErrorMessage = (rawError = "") => {
  const normalized = String(rawError || "");
  if (!normalized) return "";

  try {
    const parsed = JSON.parse(normalized);
    return parsed?.error?.message || normalized;
  } catch {
    const jsonStart = normalized.indexOf("{");
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(normalized.slice(jsonStart));
        return parsed?.error?.message || normalized;
      } catch {
        return normalized;
      }
    }
    return normalized;
  }
};

// Extract text from PDF using pdfjs (replaces pdf-parse, no library conflict)
const extractPdfTextWithPdfjs = async (buffer) => {
  const data = new Uint8Array(buffer);
  const pdfDoc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  let fullText = "";
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it) => it.str || "").join(" ") + "\n";
    page.cleanup();
  }
  return fullText.slice(0, MAX_DOC_CHARS);
};

// NodeCanvasFactory required by pdfjs-dist v2 for server-side rendering
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(cc, width, height) {
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc) {
    cc.canvas.width = 0;
    cc.canvas.height = 0;
  }
}

// Convert PDF pages to JPEG base64 images — max 5 (Groq Vision limit)
const convertPdfPagesToImages = async (buffer, maxPages = 5) => {
  const data = new Uint8Array(buffer);
  const factory = new NodeCanvasFactory();
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    canvasFactory: factory,
    verbosity: 0,
  }).promise;

  const numPages = Math.min(pdfDoc.numPages, maxPages);
  console.log(`📄 Converting ${numPages}/${pdfDoc.numPages} PDF pages to images...`);
  const images = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const cc = factory.create(Math.floor(viewport.width), Math.floor(viewport.height));

    await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise;

    images.push(cc.canvas.toBuffer("image/jpeg", { quality: 0.85 }).toString("base64"));
    factory.destroy(cc);
    page.cleanup();
  }

  console.log(`✅ Converted ${images.length} pages to images`);
  return images;
};

const generateQuizFromScannedPdfWithGroqVision = async (images, { apiKey, baseUrl, questionCount, difficulty, topic }) => {
  const systemPrompt = [
    "You are an expert quiz generator. The images show pages of a study document.",
    "Your job: read every page carefully and generate MCQ questions based STRICTLY on the content visible in the document.",
    "STRICT RULES:",
    "1. Every question must be answerable using ONLY information explicitly shown in these document pages.",
    "2. Ask about specific facts, definitions, formulas, named concepts, example values, and processes described in the document.",
    "3. Do NOT use external knowledge. Every answer must come from the document.",
    "4. Each question must have exactly 4 options. Distractors must be plausible but wrong based on the document.",
    `5. Generate exactly ${questionCount} questions.`,
    `6. Difficulty: ${difficulty}.`,
    topic ? `7. Focus on topic: ${topic}.` : "",
    "8. correctAnswer must exactly match one of the 4 option strings.",
    "",
    "Return ONLY this JSON — no markdown, no explanation:",
    '{ "questions": [ { "questionText": "...", "type": "mcq", "options": ["opt1","opt2","opt3","opt4"], "correctAnswer": "opt1", "marks": 1 } ] }',
  ].filter(Boolean).join("\n");

  const imageContent = images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:image/jpeg;base64,${img}` },
  }));

  console.log(`🤖 Sending ${images.length} PDF page images to Groq Vision...`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 3000,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Analyze all the document pages shown above. Generate exactly ${questionCount} MCQ questions based ONLY on the specific content in these pages. Return valid JSON only.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Vision error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
};

const generateQuizFromPdfWithClaude = async (fileBuffer, { questionCount, difficulty, topic }) => {
  const Anthropic = require("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = [
    "You are an expert quiz generator. Your job is to deeply analyze the uploaded document and generate MCQ questions based STRICTLY on its content.",
    "STRICT RULES:",
    "1. Read and analyze the ENTIRE document thoroughly — every page, every section.",
    "2. Identify specific facts, definitions, formulas, named concepts, examples, and key information explicitly written in the document.",
    "3. Generate questions ONLY about content that appears in the document. Do NOT use external knowledge.",
    "4. Each question must test a specific detail from the document (a named concept, a stated definition, a formula, a given example value, a described process).",
    "5. Each question must have exactly 4 options. Distractors must be plausible but wrong based on the document.",
    "6. The correct answer must be a direct fact from the document.",
    `7. Generate exactly ${questionCount} questions.`,
    `8. Difficulty level: ${difficulty}.`,
    topic ? `9. Focus on topic: ${topic}.` : "",
    "10. correctAnswer must exactly match one of the 4 options strings.",
    "",
    "Return ONLY this JSON — no markdown fences, no explanation, nothing else:",
    '{ "questions": [ { "questionText": "...", "type": "mcq", "options": ["opt1", "opt2", "opt3", "opt4"], "correctAnswer": "opt1", "marks": 1 } ] }',
  ].filter(Boolean).join("\n");

  console.log("🤖 Sending PDF to Claude for analysis...");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: fileBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `Carefully read every page of this document. Then generate exactly ${questionCount} MCQ questions based ONLY on its specific content. Return valid JSON only.`,
          },
        ],
      },
    ],
  });

  return response.content[0]?.text || "";
};

const requestQuizFromGroq = async ({
  baseUrl,
  apiKey,
  model,
  difficulty,
  topic,
  questionCount,
  studyMaterial,
  maxTokens,
  useResponseFormat,
}) => {
  const systemPrompt = [
    "You are an expert quiz generator. Your ONLY job is to read the provided document and create MCQ questions about its specific content.",
    "",
    "STRICT RULES — follow every rule exactly:",
    "1. Read the document carefully. Identify specific facts, definitions, names, processes, dates, and key concepts mentioned in the text.",
    "2. Every single question MUST be answerable using ONLY information explicitly written in the document.",
    "3. NEVER generate questions about general knowledge, external facts, or topics not mentioned in the text.",
    "4. Each question must test a SPECIFIC detail from the document (e.g. a named concept, a stated definition, a described process, a mentioned fact).",
    "5. Wrong options (distractors) must be plausible but clearly incorrect based on the document.",
    "6. The correct answer must be a direct quote or paraphrase of something written in the document.",
    `7. Generate exactly ${questionCount} questions.`,
    `8. Difficulty level: ${difficulty}.`,
    topic ? `9. Focus questions on the topic: ${topic}.` : "",
    "10. Ensure correctAnswer exactly matches one of the 4 options strings.",
    "",
    "OUTPUT FORMAT — return only this JSON, no markdown fences, no explanation:",
    '{ "questions": [ { "questionText": "string", "type": "mcq", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "marks": 1 } ] }',
  ]
    .filter(Boolean)
    .join("\n");

  const userMessage = [
    "DOCUMENT TO ANALYZE:",
    "===================",
    studyMaterial,
    "===================",
    "",
    `Based ONLY on the document above, generate exactly ${questionCount} MCQ questions.`,
    "Each question must reference a specific fact, term, or concept that appears in the document.",
    "Do not add any knowledge from outside this document.",
    "Return valid JSON only.",
  ].join("\n");

  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      ...(useResponseFormat ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
};

const callGroqTutor = async ({ question, messages, attempt, complexity, documentText }) => {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const apiKey = process.env.GROQ_API_KEY;
  const baseUrl = "https://api.groq.com/openai/v1";

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
    "- Format answers cleanly with short paragraphs, headings, and lists when helpful.",
    "- Never return one long wall of text.",
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
    const studentId = req.user.id;
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
    const studentId = req.user.id;
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
    const studentId = req.user.id;
    
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

exports.generateQuizFromMaterial = async (req, res) => {
  try {
    console.log("🎯 Quiz Generation Request:", {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      questionCount: req.body.questionCount,
      difficulty: req.body.difficulty,
      topic: req.body.topic,
      hasMaterialText: !!req.body.materialText,
      materialTextLength: req.body.materialText?.length || 0,
    });

    const apiKey = process.env.GROQ_API_KEY;
    const baseUrl = "https://api.groq.com/openai/v1";
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!apiKey) {
      console.error("❌ GROQ_API_KEY missing");
      return res.status(500).json({ message: "GROQ_API_KEY is missing in server environment variables." });
    }

    const requestedCount = Number(req.body.questionCount);
    const questionCount = Number.isFinite(requestedCount)
      ? Math.max(MIN_AI_QUIZ_QUESTIONS, Math.min(MAX_AI_QUIZ_QUESTIONS, Math.trunc(requestedCount)))
      : 10;

    const difficulty = ["easy", "medium", "hard"].includes(req.body.difficulty)
      ? req.body.difficulty
      : "medium";
    const topic = toSafeString(req.body.topic);

    const sourceFile = req.file ? saveQuizMaterialFile(req.file) : null;

    // ── Vision path for PDFs (scanned or text-based) ────────────────────────
    const isPdf = req.file && (
      (req.file.mimetype || "").includes("pdf") ||
      path.extname(req.file.originalname || "").toLowerCase() === ".pdf"
    );

    if (isPdf) {
      // Priority 1: Claude (if ANTHROPIC_API_KEY is set)
      if (process.env.ANTHROPIC_API_KEY) {
        console.log("🤖 PDF — using Claude API...");
        try {
          const claudeText = await generateQuizFromPdfWithClaude(req.file.buffer, { questionCount, difficulty, topic });
          const parsed = parseQuizJson(claudeText);
          const questions = normalizeGeneratedQuestions(Array.isArray(parsed) ? parsed : parsed?.questions);
          if (questions.length) {
            console.log("✅ Claude generated questions:", { count: questions.length });
            return res.status(200).json({ questions, generatedCount: questions.length, requestedCount: questionCount, difficulty, topic, source: "claude", sourceFile });
          }
        } catch (claudeError) {
          console.error("❌ Claude failed, trying Groq Vision:", claudeError.message);
        }
      }

      // Priority 2: Groq Vision (convert pages → JPEG → llama-4-scout)
      console.log("🤖 PDF — using Groq Vision (llama-4-scout)...");
      try {
        const images = await convertPdfPagesToImages(req.file.buffer);
        if (images.length > 0) {
          const visionText = await generateQuizFromScannedPdfWithGroqVision(images, {
            apiKey, baseUrl, questionCount, difficulty, topic,
          });
          console.log("📝 Groq Vision response preview:", visionText.slice(0, 300));
          const parsed = parseQuizJson(visionText);
          const questions = normalizeGeneratedQuestions(Array.isArray(parsed) ? parsed : parsed?.questions);
          if (questions.length) {
            console.log("✅ Groq Vision generated questions:", { count: questions.length });
            return res.status(200).json({ questions, generatedCount: questions.length, requestedCount: questionCount, difficulty, topic, source: "groq-vision", sourceFile });
          }
        }
        return res.status(500).json({ message: "Could not generate valid questions from this PDF. Try uploading a clearer scan." });
      } catch (visionError) {
        console.error("❌ Groq Vision failed:", visionError.message);
        return res.status(500).json({ message: `PDF quiz generation failed: ${visionError.message}` });
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    console.log("📚 Extracting material...");
    let studyMaterial;
    try {
      studyMaterial = await extractStudyMaterialText(req.file, req.body.materialText);
    } catch (extractError) {
      console.error("❌ Text extraction failed:", extractError.message);
      return res.status(400).json({ message: extractError.message });
    }

    console.log("📄 Material extracted:", {
      materialLength: studyMaterial.length,
      materialPreview: studyMaterial.slice(0, 300),
    });

    if (!studyMaterial) {
      console.error("❌ Study material is empty");
      return res.status(400).json({
        message: "Study material could not be read. Upload a readable PDF/DOCX/TXT file or paste the study text directly.",
      });
    }

    console.log("🚀 Calling Groq API...");
    let content = "";
    let lastErrorText = "";
    let lastStatus = 500;
    let lastProviderMessage = "";

    for (const retryConfig of QUIZ_RETRY_CONFIGS) {
      const effectiveQuestionCount = Math.min(questionCount, retryConfig.questionCap);
      const materialExcerpt = buildQuizMaterialExcerpt(studyMaterial, retryConfig.materialChars);

      console.log("🔁 Quiz generation attempt:", {
        effectiveQuestionCount,
        materialChars: materialExcerpt.length,
        maxTokens: retryConfig.maxTokens,
        useResponseFormat: retryConfig.useResponseFormat,
      });

      const response = await requestQuizFromGroq({
        baseUrl,
        apiKey,
        model,
        difficulty,
        topic,
        questionCount: effectiveQuestionCount,
        studyMaterial: materialExcerpt,
        maxTokens: retryConfig.maxTokens,
        useResponseFormat: retryConfig.useResponseFormat,
      });

      if (!response.ok) {
        lastStatus = response.status;
        lastErrorText = await response.text();
        console.error("❌ Groq API error:", { status: response.status, error: lastErrorText });
        lastProviderMessage = String(lastErrorText || "");

        const providerMessage = parseProviderErrorMessage(lastProviderMessage);
        const isRetryableProviderFailure =
          response.status >= 400 &&
          (
            providerMessage.includes("max completion tokens reached") ||
            providerMessage.includes("Failed to generate JSON") ||
            lastProviderMessage.includes("tool_use_failed") ||
            lastProviderMessage.includes("failed_generation") ||
            lastProviderMessage.includes("json_validate_failed") ||
            lastProviderMessage.includes("response_format")
          );

        if (!isRetryableProviderFailure) {
          break;
        }
        continue;
      }

      const data = await response.json();
      content = data?.choices?.[0]?.message?.content || "";
      console.log("📝 AI Content preview:", content.slice(0, 200));

      const parsed = parseQuizJson(content);
      const questions = normalizeGeneratedQuestions(Array.isArray(parsed) ? parsed : parsed?.questions);

      if (questions.length) {
        console.log("✅ Questions normalized:", { count: questions.length });
        return res.status(200).json({
          questions,
          generatedCount: questions.length,
          requestedCount: effectiveQuestionCount,
          difficulty,
          topic,
          source: "ai",
          sourceFile,
        });
      }

      lastStatus = 500;
      lastErrorText = "AI response could not be parsed as valid quiz JSON.";
    }
    console.error("❌ Quiz generation exhausted retries", {
      status: lastStatus,
      error: lastErrorText,
      providerMessage: lastProviderMessage,
      contentPreview: content.slice(0, 200),
    });

    const fallbackQuestions = buildFallbackQuestions(studyMaterial, questionCount, topic);
    if (fallbackQuestions.length) {
      console.log("🛟 Returning fallback questions:", { count: fallbackQuestions.length });
      return res.status(200).json({
        questions: fallbackQuestions,
        generatedCount: fallbackQuestions.length,
        requestedCount: questionCount,
        difficulty,
        topic,
        source: "fallback",
        sourceFile,
        warning: "AI provider limits were reached, so questions were generated from extracted study text.",
      });
    }

    return res.status(lastStatus).json({
      message: "AI quiz generation failed after retries. Try a narrower topic, paste a shorter excerpt, or upload cleaner text-based material.",
    });
  } catch (error) {
    console.error("❌ Quiz generation error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({
      message: error?.message || "Failed to generate quiz from study material. Please check server logs.",
    });
  }
};

exports.generateFlashcards = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    const baseUrl = "https://api.groq.com/openai/v1";
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const topic = toSafeString(req.body.topic);
    const notes = toSafeString(req.body.notes);
    const requestedCount = Number(req.body.cardCount);
    const cardCount = Number.isFinite(requestedCount)
      ? Math.max(5, Math.min(20, Math.trunc(requestedCount)))
      : 8;

    if (!topic && !notes) {
      return res.status(400).json({ message: "Topic or notes are required to generate flashcards." });
    }

    const sourceText = [topic, notes].filter(Boolean).join("\n\n").trim();

    const buildFallbackFlashcards = () => {
      const sentences = sourceText
        .split(/\n+/)
        .flatMap((line) => line.split(/(?<=[.!?])\s+/))
        .map((line) => toSafeString(line))
        .filter((line) => line.length > 20);

      const cards = [];

      if (topic) {
        cards.push(
          {
            question: `What are flashcards for in ${topic}?`,
            answer: `Flashcards for ${topic} help with active recall, revision, and long-term retention of core ideas.`,
            category: topic,
            difficulty: "easy",
          },
          {
            question: `Why is ${topic} important?`,
            answer: `${topic} matters because understanding its key concepts supports stronger problem solving and exam performance.`,
            category: topic,
            difficulty: "easy",
          }
        );
      }

      sentences.forEach((sentence, index) => {
        if (cards.length >= cardCount) return;
        cards.push({
          question: index % 2 === 0
            ? `What does this mean in ${topic || "the topic"}?`
            : `Explain this idea from ${topic || "the topic"}.`,
          answer: sentence,
          category: topic || "General",
          difficulty: sentence.length > 120 ? "medium" : "easy",
        });
      });

      while (cards.length < cardCount) {
        const cardNumber = cards.length + 1;
        cards.push({
          question: `Key concept ${cardNumber} in ${topic || "this topic"}`,
          answer: `Review the main definition, purpose, and real use of ${topic || "this concept"} in your own words.`,
          category: topic || "General",
          difficulty: "medium",
        });
      }

      return cards.slice(0, cardCount);
    };

    if (!apiKey) {
      return res.json({
        flashcards: buildFallbackFlashcards(),
        source: "fallback",
      });
    }

    const prompt = [
      "You generate concise educational flashcards.",
      `Create ${cardCount} flashcards based on the provided topic and notes.`,
      "Return valid JSON only with this shape:",
      '{"flashcards":[{"question":"...","answer":"...","category":"...","difficulty":"easy|medium|hard"}]}',
      "Rules:",
      "- Questions must be clear and student-friendly.",
      "- Answers must be short but complete.",
      "- Use the topic when notes are limited.",
      "- Avoid duplicates.",
      "- No markdown fences.",
      `Topic: ${topic || "Not provided"}`,
      `Notes: ${notes || "Not provided"}`,
    ].join("\n");

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You create high-quality flashcards for students." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const fallback = buildFallbackFlashcards();
      return res.status(200).json({
        flashcards: fallback,
        source: "fallback",
        warning: "AI provider failed, so flashcards were generated from local fallback logic.",
      });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(repairLikelyJson(rawContent));
    const flashcards = Array.isArray(parsed?.flashcards)
      ? parsed.flashcards
          .map((card) => ({
            question: toSafeString(card?.question),
            answer: toSafeString(card?.answer),
            category: toSafeString(card?.category) || topic || "General",
            difficulty: ["easy", "medium", "hard"].includes(card?.difficulty) ? card.difficulty : "medium",
          }))
          .filter((card) => card.question && card.answer)
          .slice(0, cardCount)
      : [];

    if (!flashcards.length) {
      return res.json({
        flashcards: buildFallbackFlashcards(),
        source: "fallback",
      });
    }

    return res.json({
      flashcards,
      source: "ai",
    });
  } catch (err) {
    console.error("Flashcard generation error:", err);
    return res.status(500).json({ message: err?.message || "Failed to generate flashcards." });
  }
};

exports.detectPlagiarism = async (req, res) => {
  res.json({ message: "⚠️ Plagiarism Detector — to be implemented" });
};
