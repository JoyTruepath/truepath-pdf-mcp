/**
 * Thin loader around pdfjs-dist for Node.js stdio use.
 *
 * We use the LEGACY build because the standard build expects a Web Worker
 * for off-thread parsing; in a stdio MCP server we just want everything on
 * the main thread, synchronous-friendly, no DOM. Legacy build does that.
 *
 * pdfjs-dist 6 is pure ESM; this file is also ESM (the package is type:module).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function loadPdf(path: string): Promise<PDFDocumentProxy> {
  const absolute = resolve(path);
  const buffer = await readFile(absolute);
  // pdfjs wants a plain Uint8Array, not a Node Buffer.
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const task = getDocument({
    data: bytes,
    disableFontFace: true,
  });
  return await task.promise;
}
