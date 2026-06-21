# Changelog

## 0.3.0 — 2026-06-21

**Free tier complete — 9 of 9 tools.** Adds the GUI-handoff piece.

- `open_in_truepath` — hand a local PDF to the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf) via its `truepath://open?path=…` URL scheme. Fire-and-forget: macOS launches (or routes to) the app and the in-app handler opens the file. Optional `scheme` param for re-branded engines (e.g. `yochenpdf` for the Yochen core build).

Requires the TruePath PDF Mac app v1.0.1+ (the v1.0.0 build in the App Store does not register the `truepath://` handler — wait for the 1.0.1 update, or build from source).

End-to-end verified: SDK Client → MCP `open_in_truepath` → `/usr/bin/open "truepath://open?path=…"` → app launches → PDF window appears.

## 0.2.0 — 2026-06-21

**Free tier complete (8 of 9 tools).** Day-3/4 from the v1 plan: page-level editing and rasterisation.

New tools:
- `split` — split one PDF into N by page ranges
- `merge` — combine N PDFs into one, preserving order
- `pages` — delete / rotate / reorder in a single pass
- `to_images` — render pages to PNG or JPG at chosen DPI
- `extract_images` — pull embedded images out as PNGs

The only remaining free-tier tool is `open_in_truepath` (URL-scheme handoff to the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf)) — landing alongside a v1.0.x app update that wires the `truepath://` handler.

Dependencies added: `pdf-lib` (MIT, for page writes) and `@napi-rs/canvas` (MIT, NAPI canvas for rasterisation and image extraction).

## 0.1.0 — 2026-06-21

Initial scaffold. Three day-1 tools shipping end-to-end over stdio:
- `get_info`, `extract_text`, `search`

Stack: TypeScript 6 (ES2022, NodeNext), `@modelcontextprotocol/sdk` 1.29, `pdfjs-dist` 6 (legacy build, no worker), `zod` 4.
