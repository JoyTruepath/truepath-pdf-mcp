import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export const mergeInput = {
  paths: z.array(z.string()).min(2).describe(
    "Two or more absolute PDF paths to combine, in order. The result preserves " +
      "pages in the order given."
  ),
  outputPath: z.string().describe(
    "Absolute path for the combined output PDF. Its parent directory will be " +
      "created if missing."
  ),
} as const;

type Args = { paths: string[]; outputPath: string };

export async function handleMerge({ paths, outputPath }: Args) {
  const outPath = resolve(outputPath);
  await mkdir(dirname(outPath), { recursive: true });

  const out = await PDFDocument.create();
  const stats: { path: string; pageCount: number }[] = [];

  for (const p of paths) {
    const absolute = resolve(p);
    const buf = await readFile(absolute);
    const src = await PDFDocument.load(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    const indices = src.getPageIndices();
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    stats.push({ path: absolute, pageCount: indices.length });
  }

  const bytes = await out.save();
  await writeFile(outPath, bytes);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        outputPath: outPath,
        totalPages: stats.reduce((s, r) => s + r.pageCount, 0),
        sources: stats,
      }, null, 2),
    }],
  };
}
