import { logger } from "./logger";

export interface ExtractionResult {
  text: string;
  pageCount: number;
  method: "pdf_parse" | "gemini_ocr" | "mammoth" | "xlsx";
}

// ── PDF (native text) ──────────────────────────────────────────────────────────
async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages, method: "pdf_parse" };
}

// ── Scanned PDF / Image → Gemini Vision OCR ───────────────────────────────────
async function extractWithGemini(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    "Extract all text from this document image exactly as it appears. Return only the raw text, preserving paragraphs and line structure. Do not summarise or add commentary.",
    { inlineData: { data: buffer.toString("base64"), mimeType } },
  ]);

  const text = result.response.text();
  return { text, pageCount: 1, method: "gemini_ocr" };
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, pageCount: 1, method: "mammoth" };
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
async function extractXLSX(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as {
    read: (b: Buffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_csv: (s: unknown) => string };
  };
  const wb = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    lines.push(`=== Sheet: ${name} ===`);
    lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
  }
  return { text: lines.join("\n"), pageCount: wb.SheetNames.length, method: "xlsx" };
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function extractText(
  buffer: Buffer,
  fileType: string,
  filename: string,
): Promise<ExtractionResult> {
  const start = Date.now();
  let result: ExtractionResult;

  switch (fileType) {
    case "pdf":
      result = await extractPDF(buffer);
      break;

    case "scanned_pdf":
      result = await extractWithGemini(buffer, "application/pdf");
      break;

    case "docx":
      result = await extractDOCX(buffer);
      break;

    case "xlsx":
      result = await extractXLSX(buffer);
      break;

    case "image":
    case "drawing": {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
      const mimeMap: Record<string, string> = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        tiff: "image/tiff", tif: "image/tiff",
      };
      result = await extractWithGemini(buffer, mimeMap[ext] ?? "image/png");
      break;
    }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  logger.debug("ingest_agent", `Text extracted via ${result.method}`, {
    filename,
    chars: result.text.length,
    pages: result.pageCount,
    latency_ms: Date.now() - start,
  });

  return result;
}

// Determine file_type enum value from MIME type / extension
export function resolveFileType(
  mimeType: string,
  filename: string,
): "pdf" | "scanned_pdf" | "docx" | "xlsx" | "image" | "drawing" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (mimeType.startsWith("image/")) return "image";

  // Fallback on extension
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (["png", "jpg", "jpeg", "tiff", "tif"].includes(ext ?? "")) return "image";
  if (["dwg", "dxf"].includes(ext ?? "")) return "drawing";

  return "pdf";
}
