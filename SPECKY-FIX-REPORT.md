# Specky Plugin Fix Report

> Audit and fixes applied to `paulasilvatech/specky` v3.3.2 during installation on `ai-maturity-client-platform`.  
> Date: 2026-04-19 | APM CLI: v0.8.11 | Target: Claude Code + GitHub Copilot (macOS Darwin 25.4.0)

---

## 1. What APM Installs Correctly

APM `install paulasilvatech/specky` successfully distributes:

| Component | Count | .github/ target | .claude/ target |
|-----------|-------|----------------|----------------|
| Agents | 13 | `.github/agents/*.agent.md` | `.claude/agents/*.md` |
| Prompts | 22 | `.github/prompts/*.prompt.md` | `.claude/commands/*.md` |
| Skills | 8 | `.github/skills/*/SKILL.md` | `.claude/skills/*/SKILL.md` |
| Instructions | 1 | `.github/instructions/` | `.claude/rules/` |
| MCP server | 1 | `.mcp.json` | `.mcp.json` |

These all work correctly out of the box. No fixes needed.

---

## 2. Issue #1 — Hook Scripts Not Distributed to `.claude/`

### Problem

The APM package includes hook scripts at `.apm/hooks/sdd-hooks.json` which references 14 shell scripts via `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/*.sh`. APM correctly distributes these scripts to `.github/hooks/specky/scripts/` but **does NOT copy them to `.claude/hooks/scripts/`**.

### What APM does

```
apm install paulasilvatech/specky
# Output includes:
#   |-- 1 hook(s) integrated -> .github/hooks/
#   |-- 1 hook(s) integrated -> .claude/settings.json
```

### What actually happens

| Target | Result |
|--------|--------|
| `.github/hooks/specky/scripts/*.sh` | ✅ 14 scripts created |
| `.github/hooks/specky/sdd-hooks.json` | ✅ Hook manifest created |
| `.claude/settings.json` `hooks` field | ❌ Set to `{}` (empty object) |
| `.claude/hooks/scripts/*.sh` | ❌ Not created (directory doesn't exist) |

### Root Cause

APM integrates the hooks JSON manifest for `.github/` correctly (copies JSON + scripts into `.github/hooks/specky/`). For `.claude/`, it recognizes the hooks file but:

1. Does not create `.claude/hooks/scripts/` directory
2. Does not copy the `.sh` scripts into it  
3. Does not parse `sdd-hooks.json` to populate `settings.json` hooks section

### Fix Applied (manual)

```bash
# 1. Copy scripts from .github to .claude
mkdir -p .claude/hooks/scripts
cp .github/hooks/specky/scripts/*.sh .claude/hooks/scripts/
chmod +x .claude/hooks/scripts/*.sh

# 2. Manually wrote settings.json hooks section (see Issue #3 below)
```

### Recommended Fix in Plugin Source

**Option A — APM should auto-distribute scripts to both targets:**

When APM detects a `.apm/hooks/` directory with a JSON manifest that references `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/*.sh`, it should:
1. Copy scripts to `.github/hooks/<package>/scripts/` (already works)
2. Copy scripts to `.claude/hooks/scripts/` (missing)
3. Parse the JSON manifest and merge into `.claude/settings.json` `hooks` section with proper matcher prefixes (missing)

**Option B — Package should include a `.claude/hooks/` distribution target:**

Add a separate hooks directory in the APM package structure:
```
.apm/
  hooks/
    sdd-hooks.json           # Copilot format (current)
    claude-settings.json     # Claude Code format (new — pre-built hooks section)
    scripts/
      branch-validator.sh
      artifact-validator.sh
      ...
```

---

## 3. Issue #2 — `settings.json` Hooks Not Wired

### Problem

After `apm install`, `.claude/settings.json` contains:
```json
{
  "permissions": { ... },
  "hooks": {}
}
```

The `hooks` field is empty. No hook will fire when Specky MCP tools are called.

### Root Cause

The `sdd-hooks.json` manifest uses this format:
```json
{
  "PreToolUse": [
    {
      "matcher": "sdd_init|sdd_create_branch",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/branch-validator.sh",
          "timeout": 5
        }
      ]
    }
  ]
}
```

Two problems:
1. **Matchers need MCP prefix** — Claude Code tool names are `mcp__specky__sdd_init`, not `sdd_init`
2. **Paths need resolution** — `${CLAUDE_PLUGIN_ROOT}` is not a Claude Code variable; paths should be relative like `bash .claude/hooks/scripts/branch-validator.sh`

### Fix Applied (manual)

Wrote the full hooks section in `.claude/settings.json` with:
- Matchers converted: `sdd_init` → `mcp__specky__sdd_init`
- Pipe-separated matchers for multi-tool rules: `mcp__specky__sdd_write_spec|mcp__specky__sdd_turnkey_spec|...`
- Paths resolved: `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/X.sh` → `.claude/hooks/scripts/X.sh`
- 9 PreToolUse rules, 8 PostToolUse rules, 1 Stop rule

### Recommended Fix in Plugin Source

The package should include a **pre-built Claude Code hooks section** that APM can merge into `settings.json`:

```json
// .apm/hooks/claude-hooks.json (new file)
{
  "PreToolUse": [
    {
      "matcher": "mcp__specky__sdd_init|mcp__specky__sdd_create_branch",
      "hooks": [
        {
          "type": "command",
          "command": "bash .claude/hooks/scripts/branch-validator.sh",
          "timeout": 5
        }
      ]
    }
    // ... all 9 PreToolUse rules
  ],
  "PostToolUse": [
    // ... all 8 PostToolUse rules
  ],
  "Stop": [
    // ... 1 Stop rule
  ]
}
```

APM should deep-merge this into `.claude/settings.json` `hooks` during install.

---

## 4. Issue #3 — Hook Scripts Use `grep -P` (Perl Regex) — Breaks on macOS

### Problem

All 14 hook scripts use `grep -P` (Perl-compatible regex) and Perl regex syntax (`\d+`, `\s`, `\b`). macOS ships with BSD grep which does NOT support `-P`. This causes scripts to exit with code 2 (invalid option), which with `set -euo pipefail` terminates the script immediately.

### Affected Scripts (all 14)

```
artifact-validator.sh   — grep -qP, grep -cP
auto-checkpoint.sh      — (no grep -P, OK)
branch-validator.sh     — (no grep -P, OK)  
cognitive-debt-alert.sh — (uses jq, OK)
drift-monitor.sh        — grep -oP, grep -iP
ears-validator.sh       — grep -cP (6 occurrences)
lgtm-gate.sh            — grep -coP
metrics-dashboard.sh    — (no grep -P, OK)
phase-gate.sh           — grep -cP
release-gate.sh         — grep -oP (2 occurrences)
security-scan.sh        — grep -oP
spec-quality.sh         — grep -cP, grep -oP
spec-sync.sh            — grep -oP
task-tracer.sh          — grep -cP, grep -vP
```

### Symptoms

```bash
$ bash .claude/hooks/scripts/spec-sync.sh
# exit code 2 (grep: invalid option -- P)

$ bash .claude/hooks/scripts/ears-validator.sh  
# exit code 2 (grep: invalid option -- P)
```

On Linux (CI, Docker, Codespaces) these scripts work fine because GNU grep supports `-P`.

### Fix Applied

Global sed replacement across all scripts in `.claude/hooks/scripts/`:

```bash
for f in .claude/hooks/scripts/*.sh; do
  # Replace grep flag variants
  sed -i '' 's/grep -oP/grep -oE/g' "$f"
  sed -i '' 's/grep -cP/grep -cE/g' "$f"
  sed -i '' 's/grep -qP/grep -qE/g' "$f"
  sed -i '' 's/grep -coP/grep -coE/g' "$f"
  sed -i '' 's/grep -iP/grep -iE/g' "$f"
  sed -i '' 's/grep -vP/grep -vE/g' "$f"
  
  # Replace Perl regex syntax with POSIX extended
  sed -i '' 's/\\d+/[0-9]+/g' "$f"
  sed -i '' 's/\\d/[0-9]/g' "$f"
  sed -i '' 's/\\s/[[:space:]]/g' "$f"
  sed -i '' 's/\\b/[[:<:]]/g' "$f"
done
```

### Recommended Fix in Plugin Source

**Fix the scripts at the source** in the Specky repo. Replace all `grep -P` with `grep -E` and Perl regex with POSIX ERE. This ensures compatibility across macOS, Linux, and CI environments.

| Perl Regex | POSIX ERE | Notes |
|-----------|-----------|-------|
| `\d+` | `[0-9]+` | Digit class |
| `\d` | `[0-9]` | Single digit |
| `\s` | `[[:space:]]` | Whitespace |
| `\b` | `[[:<:]]` / `[[:>:]]` | Word boundary (macOS only) — or remove |
| `grep -P` | `grep -E` | Extended regex flag |
| `grep -oP` | `grep -oE` | |
| `grep -cP` | `grep -cE` | |

**Alternative:** Use `ggrep` (GNU grep from Homebrew) with a fallback:
```bash
GREP=$(command -v ggrep || command -v grep)
```
But this adds a dependency. POSIX ERE is the cleaner fix.

---

## 5. Issue #4 — `declare -A` in Scripts (bash 3.2 Incompatibility)

### Problem

Some scripts use `declare -A` (associative arrays) which requires bash 4+. macOS ships with bash 3.2.

### Affected

This was only in our initially hand-written scripts (not the Specky originals). The original Specky scripts use `case` statements instead, which is correct. No fix needed in source — but worth noting in case future scripts are added.

### Recommendation

Add to Specky CONTRIBUTING.md:
```
## Shell Script Compatibility
- Target bash 3.2+ (macOS default)
- Do NOT use: declare -A, &>>, |&, coproc, mapfile
- Do NOT use: grep -P (use grep -E with POSIX ERE)
- Test on macOS before merging
```

---

## 6. Issue #5 — `sdd-hooks.json` vs `specky-sdd-hooks.json` Duplicate

### Problem

After install, `.github/hooks/specky/` contains two hook manifests:

```
.github/hooks/specky/
├── sdd-hooks.json           # From APM package
├── specky-sdd-hooks.json    # Duplicate (identical content)
└── scripts/
    └── *.sh
```

Also, `.github/hooks/specky-sdd-hooks.json` exists at the old location (from a prior install), creating confusion about which is the canonical manifest.

### Recommendation

- Ship only one manifest: `.apm/hooks/sdd-hooks.json`
- APM should place it at `.github/hooks/specky/sdd-hooks.json` (already does)
- Remove the old `.github/hooks/specky-sdd-hooks.json` (root-level duplicate)

---

## 7. Summary of Fixes Needed in Plugin Source

| Priority | Issue | Fix |
|----------|-------|-----|
| **P0** | Scripts not copied to `.claude/hooks/scripts/` | APM needs to distribute scripts to both targets |
| **P0** | `settings.json` hooks empty | Ship `claude-hooks.json` with `mcp__specky__` prefixed matchers; APM merges into settings |
| **P0** | `grep -P` breaks macOS | Replace all `grep -P` with `grep -E` + POSIX ERE in all 14 scripts |
| **P1** | `${CLAUDE_PLUGIN_ROOT}` not resolved | Use relative paths (`.claude/hooks/scripts/`) for Claude Code target |
| **P1** | Duplicate hook manifests | Ship one canonical `sdd-hooks.json`, clean up old names |
| **P2** | No bash 3.2 compat note | Add shell compatibility section to CONTRIBUTING.md |

---

## 8. File Listing — What Was Created/Modified

### Files created in `.claude/hooks/scripts/` (copied from `.github/hooks/specky/scripts/` + macOS patched):

```
.claude/hooks/scripts/
├── artifact-validator.sh    # Blocking — checks prerequisite artifacts
├── auto-checkpoint.sh       # Advisory — reminds to checkpoint
├── branch-validator.sh      # Advisory — warns on wrong branch
├── cognitive-debt-alert.sh  # Advisory — flags rubber-stamping
├── drift-monitor.sh         # Advisory — monitors spec-code drift
├── ears-validator.sh        # Advisory — validates EARS patterns
├── lgtm-gate.sh             # Advisory — prompts for human review
├── metrics-dashboard.sh     # Advisory — shows pipeline metrics
├── phase-gate.sh            # Blocking — verifies output artifact
├── release-gate.sh          # Blocking — validates release conditions
├── security-scan.sh         # Blocking — scans for hardcoded secrets
├── spec-quality.sh          # Advisory — checks spec minimum quality
├── spec-sync.sh             # Advisory — detects spec-code drift
└── task-tracer.sh           # Advisory — traces tasks to requirements
```

### Files modified:

```
.claude/settings.json        # Added full hooks section (9 Pre + 8 Post + 1 Stop)
```

### Hook test results on macOS (develop branch):

```
artifact-validator        PASS
auto-checkpoint           WARN  (spec files changed, suggests checkpoint)
branch-validator          PASS
cognitive-debt-alert      PASS
drift-monitor             PASS
ears-validator            WARN  (specs have EARS issues — expected)
lgtm-gate                 PASS
metrics-dashboard         PASS
phase-gate                PASS
release-gate              BLOCK (VERIFICATION.md missing — expected)
security-scan             PASS
spec-quality              PASS
spec-sync                 PASS
task-tracer               PASS
```
