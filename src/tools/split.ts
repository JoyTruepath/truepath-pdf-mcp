import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve, dirname } from "node:path";

export const splitInput = {
  path: z.string().describe("Absolute path to the source PDF."),
  ranges: z.array(z.string()).min(1).describe(
    "Page ranges to split into separate output PDFs, 1-based. Examples: " +
      "[\"1-3\", \"4-7\", \"8\"] produces three files. Each range becomes one output PDF."
  ),
  outputDir: z.string().optional().describe(
    "Directory to write outputs into. Defaults to the source PDF's directory."
  ),
  basename: z.string().optional().describe(
    "Stem for output filenames. Default = source filename without .pdf. " +
      "Final names look like '<basename>-1-3.pdf'."
  ),
} as const;

type Args = {
  path: string;
  ranges: string[];
  outputDir?: string;
  basename?: string;
};

function parseRange(spec: string, max: number): number[] {
  const m = spec.trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Invalid range "${spec}". Use "N" or "N-M".`);
  const lo = Math.max(1, parseInt(m[1], 10));
  const hi = m[2] ? Math.min(max, parseInt(m[2], 10)) : lo;
  if (lo > hi) throw new Error(`Range "${spec}" is empty (lo > hi).`);
  if (lo > max) throw new Error(`Range "${spec}" starts past last page (${max}).`);
  const pages: number[] = [];
  for (let i = lo; i <= hi; i++) pages.push(i);
  return pages;
}

export async function handleSplit({ path, ranges, outputDir, basename: stem }: Args) {
  const srcPath = resolve(path);
  const srcBytes = await readFile(srcPath);
  const src = await PDFDocument.load(new Uint8Array(srcBytes.buffer, srcBytes.byteOffset, srcBytes.byteLength));

  const outDir = resolve(outputDir ?? dirname(srcPath));
  await mkdir(outDir, { recursive: true });

  const stemValue = stem ?? basename(srcPath, extname(srcPath));
  const results: { range: string; pageCount: number; outputPath: string }[] = [];

  for (const r of ranges) {
    const pageNumbers = parseRange(r, src.getPageCount());
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pageNumbers.map(p => p - 1));
    for (const page of copied) out.addPage(page);
    const bytes = await out.save();
    const safe = r.replace(/[^0-9-]/g, "-");
    const outPath = join(outDir, `${stemValue}-${safe}.pdf`);
    await writeFile(outPath, bytes);
    results.push({ range: r, pageCount: pageNumbers.length, outputPath: outPath });
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ outputs: results }, null, 2) }],
  };
}
