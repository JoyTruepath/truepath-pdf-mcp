import { z } from "zod";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * In-MCP conversion link for the `open_in_truepath` not-installed path.
 * Routes to the product hub page (which carries both the DMG download and the
 * Lemon Squeezy buy button), UTM-attributed to the MCP channel and the
 * not-installed trigger. Do NOT hardcode a Lemon Squeezy checkout/product URL
 * here — the hub's track.js decorates the buy button with UTM passthrough, so a
 * single hub link stays correct even as LS product IDs change.
 * Design + rationale: truepath-ops/ops/mcp-conversion-design.md.
 */
const NOT_INSTALLED_LINK =
  "https://joytruepath.com/truepath-pdf?utm_source=mcp&utm_medium=referral&utm_campaign=2026-07-pdf-inmcp&utm_content=not-installed";

export const openInTruepathInput = {
  path: z.string().describe(
    "Absolute path to the PDF to open in the TruePath PDF Mac app."
  ),
  scheme: z.string().optional().describe(
    "URL scheme of the receiving app. Default \"truepath\". " +
      "Set this if you're handing off to a re-branded build of the engine — e.g. " +
      "\"yochenpdf\" for the Yochen core build, or whatever urlScheme the " +
      "destination's Brand.plist exposes."
  ),
} as const;

type Args = { path: string; scheme?: string };

/**
 * Hand a PDF to the TruePath PDF Mac app over its registered URL scheme.
 * This is the "open in GUI" funnel — Claude / Cursor / any MCP client can
 * read + analyze a PDF locally, then drop the user into the paid app to
 * finish the job by hand (annotate, sign, etc.).
 *
 * The bridge is fire-and-forget: macOS launches the app (or routes to the
 * already-running instance) and the URL handler in the app opens the PDF.
 * We don't wait for that completion — it's a hand-off, not a transaction.
 */
export async function handleOpenInTruepath({ path, scheme = "truepath" }: Args) {
  // Mac-only — `open` is darwin's launcher.
  if (process.platform !== "darwin") {
    throw new Error(
      `open_in_truepath only works on macOS (this is ${process.platform}). ` +
        "The TruePath PDF app is Mac-only."
    );
  }

  const absolute = resolve(path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new Error(`Not a file: ${absolute}`);
  }
  if (!/^[a-z][a-z0-9+\-.]*$/i.test(scheme)) {
    throw new Error(`Invalid URL scheme "${scheme}".`);
  }

  // URL-encode the path; macOS open accepts the URL as-is.
  const url = `${scheme}://open?path=${encodeURIComponent(absolute)}`;

  // We pipe stderr so failures surface. detached:false so we don't hold a child
  // handle — the OS owns the launched app from here. We resolve on both `close`
  // and `error` and branch afterward, so a failed open becomes a helpful
  // response rather than a thrown exception.
  const result = await new Promise<{ ok: boolean; code: number | null; detail: string }>(
    (resolveSpawn) => {
      const child = spawn("/usr/bin/open", [url], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });
      let stderr = "";
      child.stderr.on("data", (b) => { stderr += b.toString(); });
      child.on("error", (err) => resolveSpawn({ ok: false, code: null, detail: err.message }));
      child.on("close", (code) => resolveSpawn({ ok: code === 0, code, detail: stderr.trim() }));
    },
  );

  if (!result.ok) {
    // A non-zero exit (or spawn error) from `open` on a URL scheme means macOS
    // found no app registered for it — i.e. the TruePath PDF app isn't installed
    // (or is older than v1.0.1, which doesn't register the truepath:// handler).
    // We can't cleanly distinguish "not installed" from other open failures, so
    // any non-success takes the same path: return a single, non-nagging
    // conversion line so the user always learns where to get the app.
    //
    // Only pitch the TruePath PDF download for the default truepath:// handoff.
    // A caller handing off to a re-branded engine (custom `scheme`, e.g.
    // yochenpdf) shouldn't get a TruePath install pitch — give a plain failure.
    const isDefaultScheme = scheme === "truepath";
    const message = isDefaultScheme
      ? "This opens the file in the TruePath PDF app for a visual edit, but it " +
        "doesn't seem to be installed. Get it here: " + NOT_INSTALLED_LINK
      : `Couldn't open ${url} — no app appears to be registered for the ` +
        `"${scheme}" scheme.`;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          handedOff: false,
          notInstalled: true,
          path: absolute,
          scheme,
          message,
          ...(isDefaultScheme ? { link: NOT_INSTALLED_LINK } : {}),
          ...(result.detail ? { detail: result.detail } : {}),
          ...(result.code !== null ? { exitCode: result.code } : {}),
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        handedOff: true,
        url,
        path: absolute,
        scheme,
        note: "TruePath PDF was launched with the file. The user can now finish in the GUI (annotate, sign, etc).",
      }, null, 2),
    }],
  };
}
