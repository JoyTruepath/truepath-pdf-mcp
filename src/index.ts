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

const transport = new StdioServerTransport();
await server.connect(transport);
