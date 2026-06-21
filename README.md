# TruePath PDF — MCP server

**Let your AI process PDFs locally. Files never leave your Mac.**

`@truepathpdf/mcp-server` is a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets Claude, Cursor, and any other MCP-aware client read and process PDF files on your machine — without uploading them anywhere.

Built and maintained by [Joy Truepath Pte. Ltd.](https://joytruepath.com/), the team behind the [**TruePath PDF**](https://joytruepath.com/truepath-pdf) Mac app.

## Status

**v0.1 — free tier scaffold.** Three tools shipping today: `get_info`, `extract_text`, `search`. The full free tier (`split`, `merge`, `pages`, `to_images`, `extract_images`, `open_in_truepath`) and the Pro tier (`redact`, `fill_form`, `flatten`, `sign`, `compress`, `annotate`, `autocrop`, `batch`, `ocr`) land in the next two weeks.

## Privacy

- 100% local. The MCP server runs on your machine and never talks to a network.
- No telemetry, no analytics, no phone-home.
- Free tools work fully offline, forever, with no key.
- Pro tools (coming soon) are gated by an offline Ed25519 license check — still no network call at use time.

## Install

```bash
# npx — no install required
npx -y @truepathpdf/mcp-server

# or install globally
npm install -g @truepathpdf/mcp-server
truepath-pdf-mcp
```

Requires Node.js 20 or newer.

## Hook up to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "truepath-pdf": {
      "command": "npx",
      "args": ["-y", "@truepathpdf/mcp-server"]
    }
  }
}
```

Restart Claude Desktop. The `truepath-pdf` tools appear in the tool tray.

## Tools (v0.1)

### `get_info`
Page count, first-page size (with an `allSameSize` flag), encryption status, and embedded PDF metadata (title, author, dates, producer, format version).

```
{ "path": "/Users/you/Documents/report.pdf" }
```

### `extract_text`
Plain-text extraction. Optional 1-based page range (`"3"`, `"1-5"`, `"1,3,5-7"`). Output is grouped by page with `===== Page N =====` markers so you can feed it back into a prompt and the model can cite the right page.

```
{ "path": "/Users/you/Documents/report.pdf", "pages": "1-3" }
```

### `search`
Substring search across the whole document. Returns each hit's page, offset within the page, and a configurable snippet of surrounding text. Use this for grep-style discovery before doing a heavier `extract_text` over the whole file.

```
{ "path": "/Users/you/Documents/report.pdf", "query": "revenue", "contextChars": 80 }
```

## Roadmap (next 2 weeks)

### Free tier (no key, ever)
- `split` — by page range or by bookmark
- `merge` — combine N PDFs into one
- `pages` — rotate, delete, reorder
- `to_images` — render pages to PNG/JPG at a given DPI
- `extract_images` — pull embedded images out
- `open_in_truepath` — hand a PDF off to the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf) via URL scheme (so you can finish a job in a GUI)

### Pro tier (Ed25519 license key, offline verify)
- `redact` — text-preserving redaction via PDFium (the same engine the Mac app uses; the words are removed from the file, not just covered)
- `fill_form` — fill AcroForm fields, save with values preserved
- `flatten` — bake filled forms / annotations into the page stream
- `sign` — visible signature placement, signed-PDF write
- `compress` — recompress images / streams to shrink file size
- `annotate` — programmatic highlight / underline / sticky-note
- `autocrop` — detect content bounds and crop margins
- `batch` — apply any tool across a glob of files
- `ocr` — Apple Vision OCR (Mac only, on-device, CJK-strong)

A buy-once Pro key will be available via [Lemon Squeezy](https://lemonsqueezy.com/) at launch (target: USD 29, includes 12 months of updates). Owners of the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf) will be able to redeem their App Store receipt for a Pro MCP key via an in-app button.

## License

MIT for the MCP shell. Transitive dependencies:
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MIT
- [`pdfjs-dist`](https://github.com/mozilla/pdf.js) — Apache 2.0
- [`zod`](https://github.com/colinhacks/zod) — MIT

Pro tier will additionally bundle a prebuilt [PDFium](https://pdfium.googlesource.com/pdfium/) library (BSD/Apache, the same one used by Chrome).

## Contact

- Issues: <https://github.com/JoyTruepath/truepath-pdf-mcp/issues>
- Mail: support@joytruepath.com
- Joy Truepath Pte. Ltd., Singapore (UEN 202205336E)
