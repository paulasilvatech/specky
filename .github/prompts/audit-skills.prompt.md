---
description: "Audit every skill in .github/skills against the repository's GitHub Copilot authoring conventions and report or fix defects."
agent: agent
argument-hint: "optional scope, defaults to all skills under .github/skills"
---

# Audit Skills

Audit all skills under `.github/skills/` against [../instructions/skills-authoring.instructions.md](../instructions/skills-authoring.instructions.md). Report findings, then fix the safe ones.

## Checks

For each `.github/skills/<name>/SKILL.md`:

1. **Frontmatter position.** Line 1 is `---` (no blank line, BOM, or stray token before it). A leading line breaks loading.
2. **Frontmatter keys.** `name` and `description` exist. `name` equals the folder name. `description` is within 1024 characters and states what plus when. No `allowed-tools` key.
3. **Portability.** No `/home/claude`, `/mnt/skills/`, or `/mnt/user-data/` paths anywhere in the skill. No hard platform-product dependency (for example "claude.ai artifacts") in active copy. Model names and citations are allowed.
4. **Dangling references.** Every `references/`, `assets/`, or `scripts/` path mentioned in `SKILL.md` exists on disk.
5. **Scripts.** Bundled scripts run with available interpreters and are self-contained.
6. **Copy rules.** English; "GitHub Copilot" not bare "Copilot"; no em dashes; no fabricated metrics.

## Suggested commands

```bash
# Frontmatter must start at line 1
for f in .github/skills/*/SKILL.md; do [ "$(head -1 "$f")" = "---" ] || echo "FRONTMATTER NOT line 1: $f"; done

# name matches folder
for d in .github/skills/*/; do s="${d%/}"; n=$(awk -F': *' '/^name:/{print $2; exit}' "$s/SKILL.md" | tr -d '"'); [ "$n" = "$(basename "$s")" ] || echo "NAME MISMATCH: $s (name=$n)"; done

# sandbox path leaks
grep -rnI "/home/claude\|/mnt/skills\|/mnt/user-data" .github/skills && echo "LEAKS FOUND" || echo "clean"
```

## Output

Produce a table: skill, check, status (pass/fail), detail. Fix frontmatter-position, name mismatches, sandbox paths, and dangling references directly. For anything that changes a skill's meaning (generalizing platform framing, rewriting guidance), list it as a recommendation and ask before editing.

Output concisely: return only the findings table, files changed, validation status, and any critical blockers. Do not narrate the process steps.
