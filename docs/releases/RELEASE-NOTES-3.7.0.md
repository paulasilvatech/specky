# Specky 3.7.0 — Update awareness

> Copy-paste body for the GitHub Release `v3.7.0`.

**Users of old versions now find out — without the server ever phoning home.**
Until now, someone on 3.4.0 had no way to learn that 3.7.0 existed, and a
project whose `.mcp.json` pinned an old server stayed old even after
`npm install -g specky-sdd@latest`. 3.7.0 closes both gaps.

## Highlights

### 🔔 Version-drift advisory (always on, zero network)

`specky doctor`, `specky status`, and the **MCP server at startup** compare the
workspace's installed assets (`.specky/install.json`) against the running
version and nudge:

```
[specky] Installed assets are v3.5.0 but this server is v3.7.0 — run `specky upgrade` to refresh.
```

Local file comparison only — no network, stderr only, never blocks startup.
This catches the most common case: the global CLI was updated but the project's
pinned server/assets were not.

### 📬 Once-daily update banner (CLI only, opt-out)

After `install`, `doctor`, `status`, `upgrade`, or `--version`, the CLI checks
the npm registry at most once per day (2s timeout, silent offline) and prints:

```
Update available: specky-sdd v3.6.0 → v3.7.0  →  npm install -g specky-sdd@latest && specky upgrade
```

**Honesty rules, enforced in code:**

- **Never runs in `specky serve`** — the MCP server keeps making **zero
  outbound calls**, as promised.
- Disabled automatically in CI (`CI=true`).
- Opt out anytime: `SPECKY_NO_UPDATE_CHECK=1` or `update_check: false` in
  `.specky/config.yml`.
- No telemetry — nothing is sent beyond the single HTTP GET.

### 📚 "Staying up to date" docs

README now covers the full menu: the banner, the one-command upgrade (and why
`specky upgrade` matters — it re-pins `.mcp.json`), **Renovate/Dependabot** for
teams pinning per-project, and **GitHub Watch → Custom → Releases** for release
e-mails. SECURITY.md discloses the exact network behavior.

## Why not silent auto-update?

Deliberate choice: a floating `@latest` server would run any compromised
release instantly on every machine. Specky pins the server version per project
(supply-chain safety) and **notifies loudly + upgrades in one command** instead
of updating silently.

## Install / upgrade

```bash
npm install -g specky-sdd@latest   # 3.7.0
cd your-project && specky upgrade  # refreshes assets, re-pins the server
```

Full details: [CHANGELOG.md](../../CHANGELOG.md)
