# TruePath PDF — MCP server

**Let your AI process PDFs locally. Files never leave your Mac.**

`@truepathpdf/mcp-server` is a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets Claude, Cursor, and any other MCP-aware client read and process PDF files on your machine — without uploading them anywhere.

Built and maintained by [Joy Truepath Pte. Ltd.](https://joytruepath.com/), the team behind the [**TruePath PDF**](https://joytruepath.com/truepath-pdf) Mac app.

## Status

**v0.2 — free tier almost complete (8 of 9 tools).** Read + edit + rasterise: `get_info`, `extract_text`, `search`, `split`, `merge`, `pages`, `to_images`, `extract_images`. Remaining free tool — `open_in_truepath` (URL-scheme handoff to the Mac app) — lands in v0.3 alongside a v1.0.x app update. The full Pro tier (`redact`, `fill_form`, `flatten`, `sign`, `compress`, `annotate`, `autocrop`, `batch`, `ocr`) lands behind an Ed25519 license key in v0.4.

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

## Tools (v0.2)

### `get_info`
Page count, first-page size (with an `allSameSize` flag), encryption status, and embedded PDF metadata (title, author, dates, producer, format version).
```
{ "path": "/Users/you/Documents/report.pdf" }
```

### `extract_text`
Plain-text extraction. Optional 1-based page range (`"3"`, `"1-5"`, `"1,3,5-7"`). Output is grouped by page with `===== Page N =====` markers so the model can cite the right page.
```
{ "path": "/Users/you/Documents/report.pdf", "pages": "1-3" }
```

### `search`
Substring search across the whole document. Returns each hit's page, offset within the page, and a snippet of surrounding text. Use for grep-style discovery before a heavier `extract_text`.
```
{ "path": "/Users/you/Documents/report.pdf", "query": "revenue", "contextChars": 80 }
```

### `split`
Split one PDF into N by page ranges. Each range becomes one output file.
```
{ "path": "/in.pdf", "ranges": ["1-3", "4-7", "8"], "outputDir": "/out" }
```

### `merge`
Combine two or more PDFs into one, in the given order.
```
{ "paths": ["/a.pdf", "/b.pdf", "/c.pdf"], "outputPath": "/out/merged.pdf" }
```

### `pages`
Delete, rotate, and reorder pages in one pass. `delete` is applied first (page numbers in `rotate` refer to the source PDF); `reorder` is applied to the survivors.
```
{
  "path": "/in.pdf",
  "outputPath": "/out/edited.pdf",
  "delete": "2,5",
  "rotate": [{ "page": 1, "degrees": 90 }],
  "reorder": [3, 1, 2]
}
```

### `to_images`
Rasterise PDF pages as PNG or JPG at a chosen DPI. Common DPIs: `96` (screen), `150` (print preview), `300` (print).
```
{ "path": "/in.pdf", "outputDir": "/out", "pages": "1-5", "dpi": 150, "format": "png" }
```

### `extract_images`
Pull embedded images out of a PDF and write each as a PNG. Reports any images skipped because of unsupported pixel layouts (CMYK, palettized, etc).
```
{ "path": "/in.pdf", "outputDir": "/out" }
```

## Roadmap

### Free tier — one more landing in v0.3
- `open_in_truepath` — hand a PDF off to the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf) via URL scheme (so you can finish a job in a GUI). Ships alongside a v1.0.x app update that registers the handler.

### Pro tier (v0.4, Ed25519 license key, offline verify)
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
- [`pdf-lib`](https://github.com/Hopding/pdf-lib) — MIT
- [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) — MIT
- [`zod`](https://github.com/colinhacks/zod) — MIT

Pro tier will additionally bundle a prebuilt [PDFium](https://pdfium.googlesource.com/pdfium/) library (BSD/Apache, the same one used by Chrome).

## Contact

- Issues: <https://github.com/JoyTruepath/truepath-pdf-mcp/issues>
- Mail: support@joytruepath.com
- Joy Truepath Pte. Ltd., Singapore (UEN 202205336E)
