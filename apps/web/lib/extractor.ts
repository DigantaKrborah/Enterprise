import { logger } from "./logger";
import { ocrImageBuffer, ocrPDFBuffer, isScannedPDF } from "./ocr/local";

export interface ExtractionResult {
  text:      string;
  pageCount: number;
  method:    "pdf_parse" | "tesseract_ocr" | "mammoth" | "xlsx";
}

// ── PDF (native text, auto-detects scanned) ───────────────────────────────────
async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer,
  ) => Promise<{ text: string; numpages: number }>;

  const data = await pdfParse(buffer);

  // If the PDF contains almost no selectable text it is almost certainly
  // scanned. Switch to local Tesseract OCR instead of returning garbage.
  if (isScannedPDF(data.text, data.numpages)) {
    logger.info("ingest_agent", "PDF detected as scanned — switching to local OCR", {
      chars: data.text.length, pages: data.numpages,
    });
    const { text, pageCount } = await ocrPDFBuffer(buffer);
    return { text, pageCount, method: "tesseract_ocr" };
  }

  return { text: data.text, pageCount: data.numpages, method: "pdf_parse" };
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, pageCount: 1, method: "mammoth" };
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
async function extractXLSX(buffer: Buffer): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as {
    read: (b: Buffer, o: { type: string }) => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    utils: { sheet_to_csv: (s: unknown) => string };
  };
  const wb    = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    lines.push(`=== Sheet: ${name} ===`);
    lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
  }
  return { text: lines.join("\n"), pageCount: wb.SheetNames.length, method: "xlsx" };
}

// ── Image / Drawing → local Tesseract OCR ────────────────────────────────────
async function extractImage(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const text = await ocrImageBuffer(buffer, filename);
  return { text, pageCount: 1, method: "tesseract_ocr" };
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function extractText(
  buffer:   Buffer,
  fileType: string,
  filename: string,
): Promise<ExtractionResult> {
  const start = Date.now();
  let result: ExtractionResult;

  switch (fileType) {
    case "pdf":
    case "scanned_pdf":
      result = await extractPDF(buffer);
      break;

    case "docx":
      result = await extractDOCX(buffer);
      break;

    case "xlsx":
      result = await extractXLSX(buffer);
      break;

    case "image":
    case "drawing":
      result = await extractImage(buffer, filename);
      break;

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  logger.debug("ingest_agent", `Text extracted via ${result.method}`, {
    filename,
    chars:      result.text.length,
    pages:      result.pageCount,
    latency_ms: Date.now() - start,
  });

  return result;
}

// ── MIME → file_type enum ─────────────────────────────────────────────────────
export function resolveFileType(
  mimeType: string,
  filename: string,
): "pdf" | "scanned_pdf" | "docx" | "xlsx" | "image" | "drawing" {
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "xlsx";
  if (mimeType.startsWith("image/")) return "image";

  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf")                                          return "pdf";
  if (ext === "docx")                                         return "docx";
  if (ext === "xlsx")                                         return "xlsx";
  if (["png", "jpg", "jpeg", "tiff", "tif"].includes(ext ?? "")) return "image";
  if (["dwg", "dxf"].includes(ext ?? ""))                    return "drawing";

  return "pdf";
}
