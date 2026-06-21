#!/usr/bin/env node
/**
 * Smoke test: spawn the built MCP server, talk to it over stdio via the
 * official MCP TS SDK Client, list tools, then call each of the 3 day-1
 * tools against a sample PDF. Asserts the responses look right.
 *
 * Usage:
 *    node scripts/smoke.mjs [path/to/sample.pdf]
 *
 * Exits non-zero on any failure so this can drop into CI later.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const samplePdf = resolve(
  process.argv[2] ??
    "/Users/kenny/Desktop/D_個人與封存/個人公司/02_海外公司/新加坡公司/products/TruePathPDF/Quick Start Guide.pdf",
);

console.log(`smoke: sample PDF = ${samplePdf}`);

const transport = new StdioClientTransport({
  command: "node",
  args: [resolve(repoRoot, "dist", "index.js")],
});

const client = new Client(
  { name: "truepath-pdf-mcp-smoke", version: "0.0.0" },
  { capabilities: {} },
);

await client.connect(transport);
console.log("smoke: connected");

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log("smoke: tools/list →", names.join(", "));
if (names.join(",") !== "extract_text,get_info,search") {
  throw new Error(`unexpected tool set: ${names.join(",")}`);
}

// ---- get_info ----
const info = await client.callTool({ name: "get_info", arguments: { path: samplePdf } });
const infoText = info.content[0].text;
const infoJson = JSON.parse(infoText);
console.log(`smoke: get_info → pageCount=${infoJson.pageCount}  firstPage=${infoJson.firstPageSize.width}x${infoJson.firstPageSize.height}pt`);
if (!Number.isInteger(infoJson.pageCount) || infoJson.pageCount < 1) {
  throw new Error("get_info pageCount looks wrong");
}

// ---- extract_text page 1 ----
const extracted = await client.callTool({
  name: "extract_text",
  arguments: { path: samplePdf, pages: "1" },
});
const textOut = extracted.content[0].text;
console.log(`smoke: extract_text → ${textOut.length} chars, first 80: ${textOut.slice(0, 80).replace(/\n/g, " | ")}…`);
if (textOut.length < 10 || !textOut.includes("===== Page 1 =====")) {
  throw new Error("extract_text output looks wrong");
}

// ---- search ----
// pick a token that's likely in any TruePath QSG. Use "PDF" — should hit.
const found = await client.callTool({
  name: "search",
  arguments: { path: samplePdf, query: "PDF", caseSensitive: false, maxHits: 5 },
});
const searchJson = JSON.parse(found.content[0].text);
console.log(`smoke: search "PDF" → totalHits=${searchJson.totalHits} (showing first ${searchJson.hits.length})`);
if (!Array.isArray(searchJson.hits) || searchJson.totalHits < 1) {
  throw new Error("search returned no hits for 'PDF' — likely broken");
}

await client.close();
console.log("smoke: PASS");
