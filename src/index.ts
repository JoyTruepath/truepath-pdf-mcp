#!/usr/bin/env node
/**
 * TruePath PDF — MCP server (free tier, v0.1)
 *
 * Local-only. Bind your AI to PDFs on your Mac. Files never leave your
 * machine. https://joytruepath.com/truepath-pdf
 *
 * Communicates over stdio per the Model Context Protocol spec.
 *
 * Tools registered in this entry:
 *   • get_info      — page count, sizes, metadata
 *   • extract_text  — plain text, optional page range
 *   • search        — substring search with snippets
 *
 * Pro tools (redact / fill_form / flatten / sign / compress / annotate /
 * autocrop / batch / ocr) land in the next release behind an Ed25519
 * license key. See https://joytruepath.com/truepath-pdf for activation.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getInfoInput, handleGetInfo } from "./tools/get-info.js";
import { extractTextInput, handleExtractText } from "./tools/extract-text.js";
import { searchInput, handleSearch } from "./tools/search.js";
import { splitInput, handleSplit } from "./tools/split.js";
import { mergeInput, handleMerge } from "./tools/merge.js";
import { pagesInput, handlePages } from "./tools/pages.js";
import { toImagesInput, handleToImages } from "./tools/to-images.js";
import { extractImagesInput, handleExtractImages } from "./tools/extract-images.js";
import { openInTruepathInput, handleOpenInTruepath } from "./tools/open-in-truepath.js";

// Read version from package.json so we report it consistently.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { version: string };

const server = new McpServer({
  name: "truepath-pdf",
  version: pkg.version,
});

server.registerTool(
  "get_info",
  {
    title: "Get PDF info",
    description:
      "Return page count, first-page size, encryption status, and embedded metadata (title, author, dates, producer, etc.) for a local PDF.",
    inputSchema: getInfoInput,
  },
  async (args) => handleGetInfo(args),
);

server.registerTool(
  "extract_text",
  {
    title: "Extract text",
    description:
      "Extract plain text from a local PDF. Optionally restrict to a page range like \"1-5\" or \"1,3,5-7\". Output is split by page with === Page N === markers.",
    inputSchema: extractTextInput,
  },
  async (args) => handleExtractText(args),
);

server.registerTool(
  "search",
  {
    title: "Search PDF",
    description:
      "Find a substring across the whole PDF. Returns each hit's page, offset within the page, and a snippet of surrounding text. Use for grep-style discovery before extracting full text.",
    inputSchema: searchInput,
  },
  async (args) => handleSearch(args),
);

server.registerTool(
  "split",
  {
    title: "Split PDF",
    description:
      "Split a PDF into multiple PDFs by page ranges. Each range becomes one output file written into outputDir.",
    inputSchema: splitInput,
  },
  async (args) => handleSplit(args),
);

server.registerTool(
  "merge",
  {
    title: "Merge PDFs",
    description:
      "Combine two or more PDFs into one, preserving page order. Outputs to a caller-specified path.",
    inputSchema: mergeInput,
  },
  async (args) => handleMerge(args),
);

server.registerTool(
  "pages",
  {
    title: "Edit pages (rotate / delete / reorder)",
    description:
      "One-pass page editor. Delete pages, rotate specific pages by 90°/180°/270°, and reorder the result — in any combination. Page numbers in `rotate` refer to the SOURCE PDF; `reorder` refers to post-delete positions.",
    inputSchema: pagesInput,
  },
  async (args) => handlePages(args),
);

server.registerTool(
  "to_images",
  {
    title: "Render pages to images",
    description:
      "Rasterize PDF pages as PNG or JPG at a chosen DPI. Useful for previews, OCR pipelines, or feeding pages back to a vision model.",
    inputSchema: toImagesInput,
  },
  async (args) => handleToImages(args),
);

server.registerTool(
  "extract_images",
  {
    title: "Extract embedded images",
    description:
      "Pull embedded images out of a PDF and write each as a PNG. Unsupported pixel layouts (e.g. CMYK, palettized) are skipped and reported.",
    inputSchema: extractImagesInput,
  },
  async (args) => handleExtractImages(args),
);

server.registerTool(
  "open_in_truepath",
  {
    title: "Open in TruePath PDF (Mac app)",
    description:
      "Hand a local PDF to the TruePath PDF Mac app via its truepath:// URL scheme so the user can finish work in a GUI (annotate, sign, fill forms, redact). The bridge is fire-and-forget — the app handles opening from there. Requires the app installed (https://joytruepath.com/truepath-pdf).",
    inputSchema: openInTruepathInput,
  },
  async (args) => handleOpenInTruepath(args),
);

const transport = new StdioServerTransport();
await server.connect(transport);
