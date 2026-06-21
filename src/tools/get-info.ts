import { z } from "zod";
import { loadPdf } from "../lib/pdf.js";

export const getInfoInput = {
  path: z.string().describe("Absolute path to a PDF on the local filesystem."),
} as const;

type Args = { path: string };

export async function handleGetInfo({ path }: Args) {
  const pdf = await loadPdf(path);
  const meta = await pdf.getMetadata().catch(() => ({ info: {}, metadata: null }));
  const info = (meta.info ?? {}) as Record<string, unknown>;

  // First-page size for a quick "is it letter / A4" answer; page sizes can
  // differ per page in mixed-source PDFs, so we report page 1 + a flag.
  const firstPage = await pdf.getPage(1);
  const [, , w, h] = firstPage.view;
  const firstPageSize = { width: w, height: h, unit: "pt" };

  let allSameSize = true;
  if (pdf.numPages > 1) {
    for (let i = 2; i <= Math.min(pdf.numPages, 8); i++) {
      const p = await pdf.getPage(i);
      const [, , pw, ph] = p.view;
      if (pw !== w || ph !== h) { allSameSize = false; break; }
    }
  }

  const result = {
    path,
    pageCount: pdf.numPages,
    firstPageSize,
    allSameSize,
    encrypted: !!(pdf as unknown as { _pdfInfo?: { isLinearized?: boolean } })._pdfInfo,
    title: info.Title ?? null,
    author: info.Author ?? null,
    subject: info.Subject ?? null,
    keywords: info.Keywords ?? null,
    creator: info.Creator ?? null,
    producer: info.Producer ?? null,
    creationDate: info.CreationDate ?? null,
    modificationDate: info.ModDate ?? null,
    pdfVersion: info.PDFFormatVersion ?? null,
  };

  await pdf.cleanup();
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}
