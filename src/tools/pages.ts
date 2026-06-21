import { z } from "zod";
import { PDFDocument, degrees } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export const pagesInput = {
  path: z.string().describe("Absolute path to the source PDF."),
  outputPath: z.string().describe("Absolute path to write the result to."),
  delete: z.string().optional().describe(
    "Pages to delete, 1-based, comma/range form. Example: \"1,3,5-7\". " +
      "Applied BEFORE rotate and reorder."
  ),
  rotate: z.array(z.object({
    page: z.number().int().min(1).describe("1-based page number in the SOURCE PDF (pre-delete)."),
    degrees: z.union([z.literal(90), z.literal(180), z.literal(270), z.literal(-90)]),
  })).optional().describe(
    "Per-page absolute rotations applied to pages that survive the delete step. " +
      "Page numbers refer to the SOURCE PDF, not the post-delete one — easier to reason about."
  ),
  reorder: z.array(z.number().int().min(1)).optional().describe(
    "New page order, expressed as 1-based positions in the post-delete output. " +
      "Example: [3,1,2] puts page 3 first. Must be a permutation of all surviving pages."
  ),
} as const;

type RotateOp = { page: number; degrees: 90 | 180 | 270 | -90 };
type Args = {
  path: string;
  outputPath: string;
  delete?: string;
  rotate?: RotateOp[];
  reorder?: number[];
};

function parsePageList(spec: string, max: number): Set<number> {
  const out = new Set<number>();
  for (const tok of spec.split(",").map(s => s.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Invalid page token "${tok}".`);
    const lo = Math.max(1, parseInt(m[1], 10));
    const hi = m[2] ? Math.min(max, parseInt(m[2], 10)) : lo;
    for (let i = lo; i <= hi; i++) out.add(i);
  }
  return out;
}

export async function handlePages({ path, outputPath, delete: deleteSpec, rotate, reorder }: Args) {
  const srcPath = resolve(path);
  const outPath = resolve(outputPath);
  await mkdir(dirname(outPath), { recursive: true });

  const buf = await readFile(srcPath);
  const src = await PDFDocument.load(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  const srcCount = src.getPageCount();

  // 1. delete
  const deleted = deleteSpec ? parsePageList(deleteSpec, srcCount) : new Set<number>();
  const survivingSrc1Based: number[] = [];
  for (let i = 1; i <= srcCount; i++) if (!deleted.has(i)) survivingSrc1Based.push(i);
  if (survivingSrc1Based.length === 0) {
    throw new Error("Delete step removed every page — refusing to write an empty PDF.");
  }

  // 2. copy survivors into output, applying rotations
  const out = await PDFDocument.create();
  const rotMap = new Map<number, number>();
  for (const r of rotate ?? []) rotMap.set(r.page, r.degrees);

  const copied = await out.copyPages(src, survivingSrc1Based.map(p => p - 1));
  copied.forEach((page, idx) => {
    const srcPageNum = survivingSrc1Based[idx];
    const deg = rotMap.get(srcPageNum);
    if (deg !== undefined) page.setRotation(degrees(deg));
    out.addPage(page);
  });

  // 3. reorder (validate permutation)
  if (reorder) {
    const n = out.getPageCount();
    if (reorder.length !== n) {
      throw new Error(`reorder length ${reorder.length} != surviving page count ${n}.`);
    }
    const seen = new Set<number>();
    for (const pos of reorder) {
      if (pos < 1 || pos > n || seen.has(pos)) {
        throw new Error("reorder must be a permutation of 1.." + n + " (each position exactly once).");
      }
      seen.add(pos);
    }
    // pdf-lib has no in-place reorder API; rebuild via copyPages.
    const reordered = await PDFDocument.create();
    const copy2 = await reordered.copyPages(out, reorder.map(p => p - 1));
    for (const p of copy2) reordered.addPage(p);
    const bytes = await reordered.save();
    await writeFile(outPath, bytes);
  } else {
    const bytes = await out.save();
    await writeFile(outPath, bytes);
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        outputPath: outPath,
        sourcePageCount: srcCount,
        deletedCount: deleted.size,
        rotatedCount: rotate?.length ?? 0,
        reordered: !!reorder,
        finalPageCount: survivingSrc1Based.length,
      }, null, 2),
    }],
  };
}
