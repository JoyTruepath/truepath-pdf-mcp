# truepath-pdf-mcp

## ⚠️ GitHub push auth(updated 2026-06-27 — READ FIRST)

`Kennysu0425` was **removed from the JoyTruepath GitHub org** on 2026-06-27 as part of the brand-identity scrub. Default `gh auth status` may still show him as active on this machine, but **he has no push / pull access to any `JoyTruepath/*` repo anymore**.

Before any `git push` to this repo (or any other JoyTruepath repo):

```bash
gh auth switch -u joytruepath-admin
git push   # or whatever push you need
gh auth switch -u Kennysu0425   # restore default
```

`gh auth setup-git` is already configured, so HTTPS pushes auto-use whichever account is gh-active at push time. **SSH remotes will still fail** (the SSH key is tied to Kennysu0425, has no JoyTruepath access). If a remote is SSH, switch to HTTPS:

```bash
git remote set-url origin https://github.com/JoyTruepath/<repo-name>.git
```

**Symptoms when you forget:** `Repository not found`, `403 Permission denied`, `Please make sure you have the correct access rights and the repository exists.`

Full session context + decisions: <https://github.com/JoyTruepath/truepath-ops/blob/main/docs/handoff/2026-06-27-session.md>

---
