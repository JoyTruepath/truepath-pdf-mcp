import { z } from "zod";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

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

  // We pipe stderr so failures surface in the response. Detached so we don't
  // hold a child handle — the OS owns the launched app from here.
  await new Promise<void>((resolveSpawn, rejectSpawn) => {
    const child = spawn("/usr/bin/open", [url], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    let stderr = "";
    child.stderr.on("data", (b) => { stderr += b.toString(); });
    child.on("error", rejectSpawn);
    child.on("close", (code) => {
      if (code === 0) return resolveSpawn();
      const hint =
        "Make sure TruePath PDF is installed and registered. " +
        "Install: https://joytruepath.com/truepath-pdf · " +
        "Test the scheme manually: open '" + url + "'";
      rejectSpawn(new Error(
        `open exited ${code}${stderr ? `: ${stderr.trim()}` : ""}. ${hint}`,
      ));
    });
  });

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
