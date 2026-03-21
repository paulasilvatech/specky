---
name: auto-docs
description: "Update relevant documentation to match code changes"
trigger: "after code changes"
model: claude-haiku-3.5
enabled: true
---

# Auto-Docs Hook

Automatically synchronizes documentation whenever code is modified. Keeps README, API docs, and inline comments in sync with implementation changes.

## Trigger Event

- Code changes detected in `src/`, `lib/`, or `app/` directories
- Git commit message contains `[docs]`, `[api]`, or references a SPECIFICATION.md section

## Execution Steps

1. **Detect changed files** via Git diff or file system watcher
2. **Extract change summary** — function signatures, interface changes, new exports
3. **Identify doc sources** — README.md, docs/, API schema files
4. **Update relevant sections** with new signatures, examples, or parameter documentation
5. **Add migration notes** if breaking changes detected
6. **Validate links** — check that cross-references still point to valid sections
7. **Write updates** and log in SYNC_REPORT.md

## Output Format

Updated documents are written in place with:
- Clear "Updated" timestamps in frontmatter
- Migration notes for breaking changes
- Examples reflecting current signatures

## Sections Monitored

- Function/method signatures → README examples + API docs
- New public exports → module documentation
- Parameter/type changes → API reference tables
- Deprecated features → migration guides

## Model Configuration

- **Model:** claude-haiku-3.5 (consistency)
- **Temperature:** 0.2 (precise, minimal variation)
- **Max tokens:** 3000

## Notes

- Do not delete documentation; only update or append
- Mark auto-generated sections with `<!-- auto-generated -->` comments
- If documentation conflicts with code, flag in SYNC_REPORT.md for review
- Respect existing editorial style and formatting
