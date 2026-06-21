import { z } from "zod";
import { loadPdf } from "../lib/pdf.js";

export const extractTextInput = {
  path: z.string().describe("Absolute path to a PDF on the local filesystem."),
  pages: z.string().optional().describe(
    "Page range (1-based). Examples: \"3\", \"1-5\", \"1,3,5-7\". Omit for all pages."
  ),
} as const;

type Args = { path: string; pages?: string };

/** Parse "1,3,5-7" → [1,3,5,6,7], 1-based. Clamps to [1, max]. */
function parsePageRange(spec: string | undefined, max: number): number[] {
  if (!spec || spec.trim() === "") {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  const out = new Set<number>();
  for (const part of spec.split(",").map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Invalid page range token: ${part}`);
    const lo = Math.max(1, parseInt(m[1], 10));
    const hi = m[2] ? Math.min(max, parseInt(m[2], 10)) : lo;
    for (let i = lo; i <= hi; i++) out.add(i);
  }
  return Array.from(out).sort((a, b) => a - b);
}

export async function handleExtractText({ path, pages }: Args) {
  const pdf = await loadPdf(path);
  const targetPages = parsePageRange(pages, pdf.numPages);

  const blocks: { page: number; text: string }[] = [];
  for (const pageNum of targetPages) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // Concatenate text items in reading order. pdfjs already returns them
    // in left-to-right top-to-bottom order for typical PDFs.
    const lines: string[] = [];
    let lastY: number | null = null;
    let buf = "";
    for (const item of content.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (buf) lines.push(buf);
        buf = "";
      }
      buf += item.str;
      if (item.hasEOL) {
        if (buf) lines.push(buf);
        buf = "";
      }
      lastY = y;
    }
    if (buf) lines.push(buf);
    blocks.push({ page: pageNum, text: lines.join("\n") });
  }

  await pdf.cleanup();

  const text = blocks
    .map(b => `===== Page ${b.page} =====\n${b.text}`)
    .join("\n\n");

  return {
    content: [{ type: "text" as const, text }],
  };
}
