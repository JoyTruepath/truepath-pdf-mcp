import { z } from "zod";
import { loadPdf } from "../lib/pdf.js";

export const searchInput = {
  path: z.string().describe("Absolute path to a PDF on the local filesystem."),
  query: z.string().min(1).describe("Text to search for."),
  caseSensitive: z.boolean().optional().describe("Case-sensitive match. Default false."),
  contextChars: z.number().int().min(0).max(500).optional().describe(
    "How many characters of surrounding text to include per hit (default 60)."
  ),
  maxHits: z.number().int().min(1).max(1000).optional().describe(
    "Cap the number of hits returned (default 200)."
  ),
} as const;

type Args = {
  path: string;
  query: string;
  caseSensitive?: boolean;
  contextChars?: number;
  maxHits?: number;
};

type Hit = { page: number; offsetInPage: number; snippet: string };

export async function handleSearch({
  path, query, caseSensitive = false, contextChars = 60, maxHits = 200,
}: Args) {
  const pdf = await loadPdf(path);
  const needle = caseSensitive ? query : query.toLowerCase();
  const hits: Hit[] = [];

  pageLoop:
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str: string }>).map(i => i.str).join("");
    const haystack = caseSensitive ? pageText : pageText.toLowerCase();

    let from = 0;
    while (true) {
      const idx = haystack.indexOf(needle, from);
      if (idx < 0) break;
      const start = Math.max(0, idx - contextChars);
      const end = Math.min(pageText.length, idx + needle.length + contextChars);
      const lead = idx > contextChars ? "…" : "";
      const trail = end < pageText.length ? "…" : "";
      hits.push({
        page: pageNum,
        offsetInPage: idx,
        snippet: lead + pageText.slice(start, end) + trail,
      });
      if (hits.length >= maxHits) break pageLoop;
      from = idx + needle.length;
    }
  }

  await pdf.cleanup();

  const summary = {
    query,
    caseSensitive,
    totalHits: hits.length,
    truncatedAtMax: hits.length === maxHits,
    hits,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
}
