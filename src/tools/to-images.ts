import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve, dirname } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { loadPdf } from "../lib/pdf.js";

export const toImagesInput = {
  path: z.string().describe("Absolute path to the source PDF."),
  outputDir: z.string().describe("Directory to write the rendered images into."),
  pages: z.string().optional().describe(
    "1-based page range, e.g. \"3\", \"1-5\", \"1,3,5-7\". Omit for all pages."
  ),
  dpi: z.number().int().min(36).max(600).optional().describe(
    "Render resolution. Default 150. PDF native is 72; common values: 96 screen, 150 print preview, 300 print."
  ),
  format: z.enum(["png", "jpg"]).optional().describe(
    "Output format. Default \"png\". \"jpg\" is smaller but lossy."
  ),
  jpgQuality: z.number().int().min(40).max(100).optional().describe(
    "JPEG quality 40-100. Default 85. Ignored for PNG."
  ),
  basename: z.string().optional().describe(
    "Stem for output filenames. Default = source filename without .pdf. " +
      "Final names: '<basename>-001.png' (page number padded to 3 digits)."
  ),
} as const;

type Args = {
  path: string;
  outputDir: string;
  pages?: string;
  dpi?: number;
  format?: "png" | "jpg";
  jpgQuality?: number;
  basename?: string;
};

function parsePageRange(spec: string | undefined, max: number): number[] {
  if (!spec || !spec.trim()) return Array.from({ length: max }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const tok of spec.split(",").map(s => s.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Invalid page token "${tok}".`);
    const lo = Math.max(1, parseInt(m[1], 10));
    const hi = m[2] ? Math.min(max, parseInt(m[2], 10)) : lo;
    for (let i = lo; i <= hi; i++) out.add(i);
  }
  return Array.from(out).sort((a, b) => a - b);
}

export async function handleToImages({
  path, outputDir, pages, dpi = 150, format = "png", jpgQuality = 85, basename: stem,
}: Args) {
  const srcPath = resolve(path);
  const outDir = resolve(outputDir);
  await mkdir(outDir, { recursive: true });

  const pdf = await loadPdf(srcPath);
  const target = parsePageRange(pages, pdf.numPages);
  const scale = dpi / 72; // PDF native = 72 DPI
  const stemValue = stem ?? basename(srcPath, extname(srcPath));
  const ext = format === "jpg" ? "jpg" : "png";

  const outputs: { page: number; outputPath: string; width: number; height: number; bytes: number }[] = [];

  for (const pageNum of target) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    // pdfjs's render() expects a canvas-like object; @napi-rs/canvas is
    // canvas-API-compatible enough that this works for non-typography rendering.
    // We pass `canvas` itself to avoid the deprecated canvasContext path.
    // The pdfjs types want HTMLCanvasElement; cast through unknown.
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    const buf = format === "jpg"
      ? await canvas.encode("jpeg", jpgQuality)
      : await canvas.encode("png");

    const padded = String(pageNum).padStart(3, "0");
    const outPath = join(outDir, `${stemValue}-${padded}.${ext}`);
    await writeFile(outPath, buf);
    outputs.push({ page: pageNum, outputPath: outPath, width, height, bytes: buf.byteLength });
  }

  await pdf.cleanup();

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ dpi, format, outputs }, null, 2),
    }],
  };
}
