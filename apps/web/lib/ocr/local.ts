import { logger } from "@/lib/logger";

const SCANNED_THRESHOLD = 20;  // chars/page — below this a PDF is treated as scanned
const PDF_RENDER_SCALE  = 2.0; // 2x ≈ 144 dpi on A4, enough for Tesseract accuracy

export function isScannedPDF(text: string, pageCount: number): boolean {
  return text.trim().length / Math.max(pageCount, 1) < SCANNED_THRESHOLD;
}

/**
 * Inject canvas API polyfills from @napi-rs/canvas into the Node.js global scope
 * so that pdfjs-dist's legacy build can use them without requiring the unmaintained
 * `canvas` package.  Called once, before the first pdfjs-dist import.
 */
async function ensureCanvasPolyfills(): Promise<void> {
  const napi = await import("@napi-rs/canvas");
  const g = globalThis as Record<string, unknown>;
  if (!g.DOMMatrix) g.DOMMatrix = napi.DOMMatrix;
  if (!g.Path2D)    g.Path2D    = napi.Path2D;
}

/**
 * OCR a single image buffer (PNG / JPEG / TIFF / etc.) using Tesseract.js WASM.
 * 100 % local — no network calls, no cloud service.
 */
export async function ocrImageBuffer(buffer: Buffer, label = "image"): Promise<string> {
  const start = Date.now();

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const { data: { text } } = await worker.recognize(buffer);
    logger.debug("ocr", "Tesseract OCR complete", {
      label, chars: text.length, latency_ms: Date.now() - start,
    });
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Render every page of a scanned PDF to a PNG using pdfjs-dist + @napi-rs/canvas,
 * then OCR each page with Tesseract.js.
 * 100 % local — requires `@napi-rs/canvas` and `pdfjs-dist` npm packages.
 */
export async function ocrPDFBuffer(
  pdfBuffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  const start = Date.now();

  // Set polyfills before pdfjs-dist loads so it doesn't warn about missing `canvas`.
  await ensureCanvasPolyfills();

  const pdfjsLib      = require("pdfjs-dist/legacy/build/pdf.js") as typeof import("pdfjs-dist");
  const { createCanvas } = await import("@napi-rs/canvas");

  // No browser worker in Node.js.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  type NapiCanvas = { width: number; height: number; getContext(t: "2d"): unknown; toBuffer(fmt: string): Buffer };

  // pdfjs-dist calls this factory to obtain a 2-D canvas surface for each render.
  const canvasFactory = {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height) as unknown as NapiCanvas;
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(cc: { canvas: NapiCanvas }, w: number, h: number) {
      cc.canvas.width  = w;
      cc.canvas.height = h;
    },
    destroy(cc: { canvas: NapiCanvas }) {
      cc.canvas.width  = 0;
      cc.canvas.height = 0;
    },
  };

  const pdfDoc = await pdfjsLib.getDocument({
    data:            new Uint8Array(pdfBuffer),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvasFactory:   canvasFactory as any,
    useWorkerFetch:  false,
    isEvalSupported: false,
    useSystemFonts:  true,
  }).promise;

  const pageCount  = pdfDoc.numPages;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page     = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const { canvas, context } = canvasFactory.create(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const imgBuf   = canvas.toBuffer("image/png");
    const pageText = await ocrImageBuffer(imgBuf, `pdf-p${p}`);
    pageTexts.push(pageText);
    page.cleanup();
    canvasFactory.destroy({ canvas });
  }

  logger.info("ocr", "Scanned PDF OCR complete", {
    pageCount, latency_ms: Date.now() - start,
  });

  return { text: pageTexts.join("\n\n"), pageCount };
}
