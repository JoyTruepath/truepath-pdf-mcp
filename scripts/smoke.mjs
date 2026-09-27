#!/usr/bin/env node
/**
 * Smoke test — spawn the built MCP server, talk over stdio via the official
 * SDK Client, list tools, then call each of the 9 tools against a sample PDF.
 * Asserts response shapes and minimum content. Exits non-zero on any failure
 * so this can drop into CI later.
 *
 * Step 9 (open_in_truepath) REALLY opens the TruePath PDF app with the sample
 * PDF when the app is installed. Set SMOKE_SKIP_OPEN=1 to skip that step
 * (headless runs, or when you don't want a window to appear); the summary
 * then says 8 of 9 tools instead of claiming all 9.
 *
 * Usage:
 *   node scripts/smoke.mjs [path/to/sample.pdf]
 *   SMOKE_SKIP_OPEN=1 node scripts/smoke.mjs [path/to/sample.pdf]
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const samplePdf = resolve(
  process.argv[2] ??
    "/Users/kenny/Desktop/D_個人與封存/個人公司/02_海外公司/新加坡公司/products/TruePathPDF/Quick Start Guide.pdf",
);
const tmp = mkdtempSync(resolve(tmpdir(), "tpmcp-"));

console.log(`smoke: sample = ${basename(samplePdf)}`);
console.log(`smoke: tmpdir = ${tmp}`);

const transport = new StdioClientTransport({
  command: "node",
  args: [resolve(repoRoot, "dist", "index.js")],
});
const client = new Client({ name: "tpmcp-smoke", version: "0" }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
const expected = ["extract_images", "extract_text", "get_info", "merge", "open_in_truepath", "pages", "search", "split", "to_images"];
console.log(`smoke: tools/list (${names.length}) → ${names.join(", ")}`);
if (names.join(",") !== expected.join(",")) {
  throw new Error(`unexpected tool set: ${names.join(",")}`);
}

function call(name, args) {
  return client.callTool({ name, arguments: args });
}
function parseJson(res) {
  return JSON.parse(res.content[0].text);
}

// ---- 1. get_info ----
const info = parseJson(await call("get_info", { path: samplePdf }));
console.log(`✓ get_info       pageCount=${info.pageCount}  ${info.firstPageSize.width}x${info.firstPageSize.height}pt`);
if (info.pageCount < 1) throw new Error("get_info pageCount wrong");
const pageCount = info.pageCount;

// ---- 2. extract_text ----
const text = (await call("extract_text", { path: samplePdf, pages: "1" })).content[0].text;
console.log(`✓ extract_text   ${text.length} chars on page 1`);
if (!text.includes("===== Page 1 =====") || text.length < 10) throw new Error("extract_text wrong");

// ---- 3. search ----
const found = parseJson(await call("search", { path: samplePdf, query: "PDF", maxHits: 5 }));
console.log(`✓ search "PDF"   totalHits=${found.totalHits} (top ${found.hits.length})`);
if (found.totalHits < 1) throw new Error("search no hits");

// ---- 4. split ----
const splitJson = parseJson(await call("split", {
  path: samplePdf,
  ranges: pageCount >= 2 ? ["1", "2-" + pageCount] : ["1"],
  outputDir: tmp,
  basename: "qsg",
}));
for (const o of splitJson.outputs) {
  if (!existsSync(o.outputPath)) throw new Error("missing split output " + o.outputPath);
}
console.log(`✓ split          ${splitJson.outputs.length} files (${splitJson.outputs.map(o => o.range).join(", ")})`);

// ---- 5. merge (back into one) ----
const mergedPath = resolve(tmp, "merged.pdf");
const mergeJson = parseJson(await call("merge", {
  paths: splitJson.outputs.map(o => o.outputPath),
  outputPath: mergedPath,
}));
if (mergeJson.totalPages !== pageCount) {
  throw new Error(`merge wrong: ${mergeJson.totalPages} vs ${pageCount}`);
}
console.log(`✓ merge          ${mergeJson.totalPages} pages, ${statSync(mergedPath).size}B`);

// ---- 6. pages (delete + rotate) ----
const editedPath = resolve(tmp, "edited.pdf");
const pagesJson = parseJson(await call("pages", {
  path: samplePdf,
  outputPath: editedPath,
  delete: pageCount >= 3 ? "2" : undefined,
  rotate: [{ page: 1, degrees: 90 }],
}));
console.log(`✓ pages          source=${pagesJson.sourcePageCount} → final=${pagesJson.finalPageCount}, deleted=${pagesJson.deletedCount}, rotated=${pagesJson.rotatedCount}`);

// ---- 7. to_images ----
const imgJson = parseJson(await call("to_images", {
  path: samplePdf,
  outputDir: tmp,
  pages: "1",
  dpi: 96,
  format: "png",
}));
const firstImg = imgJson.outputs[0];
if (!existsSync(firstImg.outputPath)) throw new Error("to_images missing output");
console.log(`✓ to_images      page 1 → ${basename(firstImg.outputPath)} ${firstImg.width}x${firstImg.height}, ${firstImg.bytes}B`);

// ---- 8. extract_images ----
const exImg = parseJson(await call("extract_images", {
  path: samplePdf,
  outputDir: tmp,
  basename: "ex",
}));
console.log(`✓ extract_images extracted=${exImg.extractedCount}, skipped=${exImg.skippedCount}`);
// (sample QSG may have 0 embedded images — accept either as long as it runs)

// ---- 9. open_in_truepath ----
// Only run if the TruePath PDF app is installed locally and SMOKE_SKIP_OPEN is
// not set; otherwise log + skip. An error here FAILS the smoke (it used to be
// printed as "✓ … ERROR" and still reported PASS).
const skipOpen = process.env.SMOKE_SKIP_OPEN === "1";
let openCheck = skipOpen
  ? "skipped (SMOKE_SKIP_OPEN=1)"
  : "skipped (no /Applications/TruePath PDF.app and no local Release build)";
let openRan = false;
let openFailed = false;
if (!skipOpen) try {
  const probe = await import("node:fs");
  const candidates = [
    "/Applications/TruePath PDF.app",
    resolve(repoRoot, "..", "TruePathPDF", "build", "Release", "TruePath PDF.app"),
  ];
  const found = candidates.find(p => probe.existsSync(p));
  if (found) {
    openRan = true;
    const r = parseJson(await call("open_in_truepath", { path: samplePdf }));
    if (!r.handedOff) throw new Error("open_in_truepath did not report handedOff");
    openCheck = `OK (handoff URL = ${r.url.slice(0, 30)}…)`;
    // Don't wait for the app — fire and forget per the contract.
  }
} catch (e) {
  openFailed = true;
  openCheck = `ERROR: ${e.message}`;
}
console.log(`${openFailed ? "✗" : "✓"} open_in_truepath ${openCheck}`);

await client.close();
rmSync(tmp, { recursive: true, force: true });
if (openFailed) {
  console.log("\nsmoke: FAIL — open_in_truepath errored");
  process.exit(1);
}
console.log(openRan
  ? "\nsmoke: PASS — all 9 tools v0.3"
  : "\nsmoke: PASS — 8 of 9 tools v0.3 (open_in_truepath skipped)");
