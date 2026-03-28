/**
 * Load pdf.js from CDN at runtime — bypasses Webpack bundling entirely.
 * Shared between PdfViewer and thumbnail generator.
 */

interface PdfjsLib {
  getDocument: (
    src: { url: string } | { data: ArrayBuffer }
  ) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

interface PdfDocument {
  numPages: number;
  getPage: (num: number) => Promise<PdfPage>;
}

interface PdfPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (ctx: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib;
  }
}

export type { PdfjsLib, PdfDocument, PdfPage };

const PDFJS_VERSION = "4.9.155";
const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let loadPromise: Promise<PdfjsLib> | null = null;

export function loadPdfJs(): Promise<PdfjsLib> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PdfjsLib>((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    moduleScript.textContent = `
      import * as pdfjsLib from "${CDN_BASE}/pdf.min.mjs";
      pdfjsLib.GlobalWorkerOptions.workerSrc = "${CDN_BASE}/pdf.worker.min.mjs";
      window.pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event("pdfjsLoaded"));
    `;

    window.addEventListener(
      "pdfjsLoaded",
      () => {
        if (window.pdfjsLib) resolve(window.pdfjsLib);
        else reject(new Error("pdf.js failed to load"));
      },
      { once: true }
    );

    document.head.appendChild(moduleScript);
    setTimeout(() => reject(new Error("pdf.js load timeout")), 15000);
  });

  return loadPromise;
}

/**
 * Extract page count + generate thumbnail from a PDF file.
 * Renders page 1 to an offscreen canvas and returns a JPEG blob.
 *
 * @param file - The PDF File object
 * @param thumbnailWidth - Width of the thumbnail in pixels (default 400)
 * @returns { pageCount, thumbnailBlob }
 */
export async function extractPdfMetadata(
  file: File,
  thumbnailWidth = 400
): Promise<{ pageCount: number; thumbnailBlob: Blob }> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;

  const pageCount = pdf.numPages;

  // Render page 1 to offscreen canvas
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = thumbnailWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert to JPEG blob
  const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate thumbnail"));
      },
      "image/jpeg",
      0.85
    );
  });

  return { pageCount, thumbnailBlob };
}
