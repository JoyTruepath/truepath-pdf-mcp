# Changelog

## 0.3.2 — 2026-09-27

**Security update — upgrade recommended.** No tool changes.

- **`pdfjs-dist` 6.0.227 → 6.3.289** ([GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j): arbitrary JavaScript execution upon opening a malicious PDF; affects `>=5.6.83 <6.2.108`; severity high). This server opens untrusted PDFs, so we take PDF.js advisories straight away. As far as we can tell 0.3.1 was not exposed: the advisory needs PDF.js scripting enabled, and this server never enables it (it doesn't use the viewer or the annotation layer). The minimum is now `^6.3.289`, so a fresh `npx` install can't resolve to an affected version.
- **`@modelcontextprotocol/sdk` 1.29.0 → 1.30.1**, and the lockfile moved its transitive dependencies to patched releases: `fast-uri` and `ip-address` (high), `hono`, `@hono/node-server` and `qs` (moderate). They come in through the SDK (its HTTP transport, rate limiter and JSON-schema validator), not this server's own code; `npm audit` now reports 0 vulnerabilities.
- **Node.js 22.13 or newer is now required** (`engines`, README). PDF.js 6 already needed it; every earlier 0.3.x already ran on PDF.js 6, so this corrects the stated requirement rather than raising the real one.
- The smoke test now fails when `open_in_truepath` fails (it used to report PASS), says "8 of 9" when that step is skipped, and has `SMOKE_SKIP_OPEN` / `SMOKE_REQUIRE_OPEN` switches; the release check requires all 9.
- Verified with the release checklist: clean install, build, and the 9-tool smoke test. The eight file tools return identical results to 0.3.1 on the sample document.

## 0.3.1 — 2026-07-06

**`open_in_truepath` now converts on the not-installed path.** When the handoff to the [TruePath PDF Mac app](https://joytruepath.com/truepath-pdf) fails because the app isn't installed (no `truepath://` handler registered — e.g. the app is absent or older than v1.0.1), the tool no longer just errors. It returns a single, non-nagging line pointing to the download:

> "This opens the file in the TruePath PDF app for a visual edit, but it doesn't seem to be installed. Get it here: …"

The link routes to the product hub page (DMG + Lemon Squeezy doors), UTM-attributed to the MCP channel. The pitch is only emitted for the default `truepath://` handoff — a custom `scheme` (re-branded engine) gets a plain failure, and no other tool is touched.

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
