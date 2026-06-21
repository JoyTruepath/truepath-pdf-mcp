import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createCanvas, ImageData as CanvasImageData } from "@napi-rs/canvas";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPdf } from "../lib/pdf.js";

export const extractImagesInput = {
  path: z.string().describe("Absolute path to the source PDF."),
  outputDir: z.string().describe("Directory to write extracted images into."),
  pages: z.string().optional().describe(
    "1-based page range. Omit for all pages. Format: \"1-5\" or \"1,3,5-7\"."
  ),
  basename: z.string().optional().describe(
    "Stem for output filenames. Default = source name. Final form: '<stem>-p001-img01.png'."
  ),
} as const;

type Args = { path: string; outputDir: string; pages?: string; basename?: string };

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

const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject,
]);

type ExtractedImage = {
  page: number;
  index: number;
  width: number;
  height: number;
  outputPath: string;
  bytes: number;
};

/** Best-effort write of a pdfjs image object as PNG. Returns null if unhandled. */
async function writeImage(
  img: { width?: number; height?: number; data?: Uint8ClampedArray | Uint8Array; kind?: number; bitmap?: unknown },
  outputPath: string,
): Promise<{ width: number; height: number; bytes: number } | null> {
  const w = img.width;
  const h = img.height;
  if (!w || !h || !img.data) return null;

  // Normalize to RGBA Uint8ClampedArray for canvas.putImageData
  const src = img.data;
  const expectedRGBA = w * h * 4;
  let rgba: Uint8ClampedArray;

  if (src.length === expectedRGBA) {
    rgba = src instanceof Uint8ClampedArray ? src : new Uint8ClampedArray(src.buffer, src.byteOffset, src.byteLength);
  } else if (src.length === w * h * 3) {
    // RGB → RGBA
    rgba = new Uint8ClampedArray(expectedRGBA);
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      rgba[j] = src[i]; rgba[j + 1] = src[i + 1]; rgba[j + 2] = src[i + 2]; rgba[j + 3] = 255;
    }
  } else if (src.length === w * h) {
    // Greyscale → RGBA
    rgba = new Uint8ClampedArray(expectedRGBA);
    for (let i = 0, j = 0; i < src.length; i++, j += 4) {
      rgba[j] = src[i]; rgba[j + 1] = src[i]; rgba[j + 2] = src[i]; rgba[j + 3] = 255;
    }
  } else {
    return null; // Unknown kind (CMYK, palettized, etc.) — skip for v0.1
  }

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const imageData = new CanvasImageData(rgba, w, h);
  ctx.putImageData(imageData, 0, 0);
  const buf = await canvas.encode("png");
  await writeFile(outputPath, buf);
  return { width: w, height: h, bytes: buf.byteLength };
}

export async function handleExtractImages({ path, outputDir, pages, basename: stem }: Args) {
  const srcPath = resolve(path);
  const outDir = resolve(outputDir);
  await mkdir(outDir, { recursive: true });

  const pdf = await loadPdf(srcPath);
  const target = parsePageRange(pages, pdf.numPages);
  const stemValue = stem ?? basename(srcPath, extname(srcPath));

  const outputs: ExtractedImage[] = [];
  const skipped: { page: number; name: string; reason: string }[] = [];

  for (const pageNum of target) {
    const page = await pdf.getPage(pageNum);

    // Trigger a render to a discardable canvas to resolve all image objs.
    // We don't keep the output; we just need page.objs to populate.
    const vp = page.getViewport({ scale: 1 });
    const tmp = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    await page.render({ canvas: tmp as unknown as HTMLCanvasElement, viewport: vp }).promise;

    const ops = await page.getOperatorList();
    const seen = new Set<string>();
    let idxOnPage = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (!IMAGE_OPS.has(ops.fnArray[i])) continue;
      const name = String(ops.argsArray[i][0]);
      if (seen.has(name)) continue;
      seen.add(name);
      let img: { width?: number; height?: number; data?: Uint8ClampedArray | Uint8Array } | null = null;
      try {
        img = page.objs.has(name) ? page.objs.get(name) : page.commonObjs.get(name);
      } catch {
        skipped.push({ page: pageNum, name, reason: "objs.get threw" });
        continue;
      }
      if (!img) { skipped.push({ page: pageNum, name, reason: "null object" }); continue; }
      idxOnPage++;
      const padded = `p${String(pageNum).padStart(3, "0")}-img${String(idxOnPage).padStart(2, "0")}`;
      const outPath = join(outDir, `${stemValue}-${padded}.png`);
      const wrote = await writeImage(img, outPath);
      if (!wrote) {
        skipped.push({ page: pageNum, name, reason: "unsupported pixel layout" });
        continue;
      }
      outputs.push({ page: pageNum, index: idxOnPage, ...wrote, outputPath: outPath });
    }
  }

  await pdf.cleanup();

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        extractedCount: outputs.length,
        skippedCount: skipped.length,
        outputs,
        ...(skipped.length ? { skipped } : {}),
      }, null, 2),
    }],
  };
}
