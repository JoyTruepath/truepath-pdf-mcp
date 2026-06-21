# Releasing `@truepathpdf/mcp-server`

Internal runbook for cutting an npm release.

## Prerequisites

- Be logged in as the npm publisher account that owns the `@truepathpdf` scope:
  ```bash
  npm whoami            # should print the publisher
  npm adduser           # only the first time, or after `npm logout`
  ```
- The `@truepathpdf` npm scope must exist and be writable. The first publish
  also CREATES the scope; subsequent publishes attach to it.
- Be on a clean `main` branch (no uncommitted edits, no untracked files in the
  publish set).

## Pre-publish checklist

Run from the repo root:

```bash
# 1. clean slate
rm -rf dist node_modules
npm install

# 2. build + smoke (asserts all 9 tools work end-to-end)
npm run build
node scripts/smoke.mjs   # PASS required

# 3. dry-run the tarball — verify exactly what ships
npm pack --dry-run
```

The dry-run output must look like this (sizes/shas drift; structure should not):

- `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json` (root metadata)
- `dist/index.{js,d.ts,js.map}` (server entry, with shebang `#!/usr/bin/env node`)
- `dist/lib/pdf.{js,d.ts,js.map}` (pdfjs loader)
- `dist/tools/*.{js,d.ts,js.map}` (one set per tool)

It MUST NOT include `src/`, `node_modules/`, `scripts/`, `tsconfig.json`, or
`docs/` — the `files` field in `package.json` controls that.

## Cut the release

1. Bump `version` in `package.json` (semver — patch for bugfix, minor for new
   tool, major for breaking schema change).
2. Update `CHANGELOG.md` with the new entry at the top.
3. Commit + tag:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
4. Publish. The first publish of the scope needs `--access public`; later
   publishes don't but it doesn't hurt to keep it for clarity:
   ```bash
   npm publish --access public
   ```

`prepublishOnly` runs `npm run build` automatically, so the dist tree is
always fresh. There is no provenance signing configured yet — add later when
the repo is established.

## Post-publish

- Verify the listing:
  ```bash
  npm view @truepathpdf/mcp-server
  ```
- Verify install + run from a clean env:
  ```bash
  cd /tmp && npx -y @truepathpdf/mcp-server < /dev/null
  # (stdio server; exits quickly when stdin closes, no errors expected)
  ```
- Update [joytruepath.com/truepath-pdf](https://joytruepath.com/truepath-pdf)'s
  developer section if anything changed in the tool list, the install snippet,
  or the prerequisites.
- Create a GitHub release on the tag with the CHANGELOG entry as the body.

## Submitting to MCP registries

After the first public npm release:

- **Anthropic registry** (mcp-servers-list / official directory): submit a PR
  to the appropriate registry repo with the package name, description, and
  install command.
- **Smithery** (`smithery.ai`): sign in, point at the GitHub repo, fill out
  the install command + tool list.
- **awesome-mcp-servers** (community list): open a PR adding an entry.

Pin one canonical install command in every listing so install instructions
don't drift:

```
npx -y @truepathpdf/mcp-server
```

## Notes on the URL-handler dependency

`open_in_truepath` requires the TruePath PDF Mac app to register the
`truepath://` URL scheme. Build 7 of the app does NOT register the scheme;
build 8 and later do. While v1.0 is in App Store review, the README should
say "requires TruePath PDF v1.0.1 or newer." Once the v1.0 binary that ships
to users is build 8 or later, update the README to "requires TruePath PDF
v1.0 or newer."

The other 8 tools (`get_info`, `extract_text`, `search`, `split`, `merge`,
`pages`, `to_images`, `extract_images`) have no dependency on the Mac app.
