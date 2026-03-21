---
name: changelog
description: "Generate or update CHANGELOG.md entry from completed tasks and spec changes"
trigger: "before release / after feature completion"
model: claude-haiku-3.5
enabled: true
---

# Changelog Hook

Automatically generates or updates CHANGELOG.md entries whenever features are completed or specifications change. Maintains semantic versioning and readable release notes.

## Trigger Event

- Feature task marked as `completed`
- Release version incremented in package.json or version file
- Manual changelog update requested
- Tag created (Git)

## Execution Steps

1. **Gather completed features** from tasks marked `done`
2. **Read spec changes** from SPECIFICATION.md version history
3. **Categorize changes**:
   - Features (new SPECIFICATION sections)
   - Fixes (completed bug tasks)
   - Breaking Changes (spec version bumps)
   - Deprecations (features marked obsolete)
4. **Generate entry** in semver format (major.minor.patch)
5. **Append to CHANGELOG.md** with timestamp and author
6. **Update "Unreleased" section** or create new version header

## Output Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- [feature]: [brief description] (#task-id)

### Fixed
- [bug]: [brief description] (#task-id)

### Changed
- [change]: [description]

### Deprecated
- [feature]: [reason, migration path]

### Security
- [security fix]: [description]
```

## Changelog Template

Prepended entry follows Keep-a-Changelog format:
- One entry per release
- Unreleased section always at top
- Semantic versioning enforced
- Links to issues/PRs when available

## Model Configuration

- **Model:** claude-haiku-3.5 (consistent voice)
- **Temperature:** 0.3 (concise, friendly tone)
- **Max tokens:** 1500

## Notes

- Write entries in plain English, user-friendly language
- Do not include implementation details; focus on user impact
- Keep entries under 10 lines per bullet point
- Reference task IDs for traceability
- Maintain consistent tense (past tense for completed work)
