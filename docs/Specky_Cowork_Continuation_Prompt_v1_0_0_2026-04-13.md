---
title: "Specky Plugin Ecosystem — Cowork Continuation Prompt"
description: "Complete context to rebuild the final Specky ecosystem package with full dual-target parity"
author: "Paula Silva"
date: "2026-04-13"
version: "1.0.0"
status: "ready-for-execution"
---

# Specky Plugin Ecosystem — Build the Final Package

## Context

You are building the **Specky SDD Plugin Ecosystem** — a one-click installer that configures the complete Spec-Driven Development pipeline for any project. Specky (`specky-sdd` on npm, v3.2.0) is an MCP server with 57 tools across a 10-phase pipeline.

**The rule: EVERYTHING must be dual-target — Claude Code AND VS Code + GitHub Copilot. No exceptions.**

## What Already Exists (DO NOT REBUILD)

These files are DONE and tested. Copy them as-is from the previous session's outputs or recreate from the specs below:

### 4 Agent files (`.github/agents/`) — DONE
- `implementer.agent.md` — Phase 6, Sonnet 4.6, thinking: false
- `test-verifier.agent.md` — Phase 7, Sonnet 4.6
- `release-engineer.agent.md` — Phase 9, Haiku 4.5
- `research-analyst.agent.md` — Phase 1, Sonnet 4.6

### 7 Command files (`.claude/commands/`) — DONE
- `sdd-implement.md`, `sdd-test.md`, `sdd-release.md`, `sdd-research.md`
- `sdd-init.md`, `sdd-clarify.md`, `sdd-requirements.md`

### 5 Skill files (`.specky/skills/*/SKILL.md`) — DONE
- `implementer/SKILL.md`, `test-verifier/SKILL.md`, `release-engineer/SKILL.md`
- `research-analyst/SKILL.md`, `sdd-markdown-standard/SKILL.md`

### 10 Shell hook scripts — DONE
- `spec-sync.sh`, `security-scan.sh` (BLOCKING), `release-gate.sh` (BLOCKING)
- `auto-checkpoint.sh`, `spec-quality.sh`, `task-tracer.sh`
- `ears-validator.sh`, `drift-monitor.sh`, `cognitive-debt-alert.sh`, `metrics-dashboard.sh`

### 10 GitHub Actions workflows — DONE
- Same 10 hooks as `.yml` files for `.github/workflows/`

### 2 Doc files — DONE
- `INSTALL.md` — Complete pipeline map with all commands
- `Specky_Plugin_Ecosystem_Blueprint_v1_0_0_2026-04-13.md` — Full ecosystem blueprint

## What Must Be BUILT NEW

### GAP 1: 3 Missing Copilot Agents (parity with Claude Code commands)

Claude Code has `/sdd:init`, `/sdd:clarify`, `/sdd:requirements` commands but there are NO corresponding Copilot agents. Create:

**`sdd-init.agent.md`** — Phase 0 agent
```yaml
---
name: sdd-init
description: "Initialize SDD pipeline for a new feature. Creates .specs/NNN-feature/ directory with CONSTITUTION.md and pipeline state."
model: claude-haiku-4-5
tools: ['sdd_init', 'sdd_scan_codebase']
thinking: low
handoffs:
  - label: "Init complete — start research"
    agent: research-analyst
    send: false
---
```
- Model: Haiku 4.5 (scaffolding only, no reasoning)
- Reads FRD/NFRD from `docs/requirements/` if they exist
- Calls `sdd_init`, then suggests `@research-analyst`

**`sdd-clarify.agent.md`** — Phase 2 agent
```yaml
---
name: sdd-clarify
description: "Disambiguate requirements in SPECIFICATION.md. Identifies ambiguities, validates EARS patterns, resolves gaps through interactive questions."
model: claude-opus-4-6
tools: ['sdd_clarify', 'sdd_validate_ears', 'sdd_turnkey_spec']
thinking: high
handoffs:
  - label: "Clarification complete — finalize spec"
    agent: spec-engineer
    send: false
---
```
- Model: Opus + thinking (ambiguity resolution requires deep reasoning)
- Loads `sdd-spec-engineer` skill + `references/ears-notation.md`
- Calls `sdd_clarify` → presents questions → calls `sdd_validate_ears`

**`requirements-engineer.agent.md`** — Pre-pipeline agent (ALREADY EXISTS but verify it's in the package)

### GAP 2: 3 Hook Config JSON Files (one per platform)

All three use the SAME 10 shell scripts in `.specky/hooks/` (shared location). The JSON files just register them differently per platform.

**`.claude/settings.json`** — Claude Code hook registration
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "sdd_create_pr",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/security-scan.sh", "timeout": 30000 },
          { "type": "command", "command": "bash .specky/hooks/release-gate.sh", "timeout": 15000 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|sdd_write_spec|sdd_write_design|sdd_write_tasks",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/spec-sync.sh", "timeout": 10000 },
          { "type": "command", "command": "bash .specky/hooks/auto-checkpoint.sh", "timeout": 5000 }
        ]
      },
      {
        "matcher": "sdd_write_spec|sdd_turnkey_spec",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/spec-quality.sh", "timeout": 10000 },
          { "type": "command", "command": "bash .specky/hooks/ears-validator.sh", "timeout": 10000 }
        ]
      },
      {
        "matcher": "sdd_write_tasks",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/task-tracer.sh", "timeout": 10000 }
        ]
      },
      {
        "matcher": "sdd_run_analysis|sdd_cross_analyze|sdd_compliance_check",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/drift-monitor.sh", "timeout": 10000 },
          { "type": "command", "command": "bash .specky/hooks/cognitive-debt-alert.sh", "timeout": 10000 },
          { "type": "command", "command": "bash .specky/hooks/metrics-dashboard.sh", "timeout": 5000 }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "bash .specky/hooks/security-scan.sh", "timeout": 30000 }
        ]
      }
    ]
  }
}
```

**`.github/hooks/sdd-hooks.json`** — GitHub Copilot CLI + Cloud Agent
```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "bash .specky/hooks/security-scan.sh", "timeoutSec": 30 },
      { "type": "command", "bash": "bash .specky/hooks/release-gate.sh", "timeoutSec": 15 }
    ],
    "postToolUse": [
      { "type": "command", "bash": "bash .specky/hooks/spec-sync.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/auto-checkpoint.sh", "timeoutSec": 5 },
      { "type": "command", "bash": "bash .specky/hooks/spec-quality.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/ears-validator.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/task-tracer.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/drift-monitor.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/cognitive-debt-alert.sh", "timeoutSec": 10 },
      { "type": "command", "bash": "bash .specky/hooks/metrics-dashboard.sh", "timeoutSec": 5 }
    ],
    "sessionEnd": [
      { "type": "command", "bash": "bash .specky/hooks/security-scan.sh", "timeoutSec": 30 }
    ]
  }
}
```

**`.vscode/settings.json`** — VS Code + GitHub Copilot (merge into existing)
```json
{
  "github.copilot.chat.hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "bash .specky/hooks/security-scan.sh",
        "timeout": 30
      },
      {
        "type": "command",
        "command": "bash .specky/hooks/release-gate.sh",
        "timeout": 15
      }
    ],
    "PostToolUse": [
      { "type": "command", "command": "bash .specky/hooks/spec-sync.sh" },
      { "type": "command", "command": "bash .specky/hooks/auto-checkpoint.sh" },
      { "type": "command", "command": "bash .specky/hooks/spec-quality.sh" },
      { "type": "command", "command": "bash .specky/hooks/ears-validator.sh" },
      { "type": "command", "command": "bash .specky/hooks/task-tracer.sh" },
      { "type": "command", "command": "bash .specky/hooks/drift-monitor.sh" },
      { "type": "command", "command": "bash .specky/hooks/cognitive-debt-alert.sh" },
      { "type": "command", "command": "bash .specky/hooks/metrics-dashboard.sh" }
    ]
  }
}
```

### GAP 3: Hook scripts must move to SHARED location

Currently hooks are in `.claude/hooks/` (Claude-only). They must be in `.specky/hooks/` (shared) so ALL platforms reference the same scripts. All 3 JSON configs above point to `.specky/hooks/*.sh`.

### GAP 4: `HOOKS-README.md` — Reference doc explaining the 3-layer system

Already written in previous session. Include in the zip.

### GAP 5: Updated `install.sh` — 10 steps (was 9)

The installer must do:
1. Install `specky-sdd` via npm
2. Create `.vscode/mcp.json` (VS Code MCP config)
3. Register with `claude mcp add` (Claude Code MCP config)
4. Copy 7 agents → `.github/agents/` (was 4, now 7 with init + clarify + requirements-engineer)
5. Copy 7 commands → `.claude/commands/`
6. Copy 5 skills → `.specky/skills/`
7. Copy 10 hook scripts → `.specky/hooks/` (SHARED location, not .claude/hooks/)
8. Copy 10 GitHub Actions → `.github/workflows/`
9. Create/merge 3 hook config JSONs:
   - `.claude/settings.json` (Claude Code)
   - `.github/hooks/sdd-hooks.json` (Copilot CLI/Cloud)
   - Merge into `.vscode/settings.json` (VS Code Copilot)
10. Create `.specky/config.yml` + verify all files

## Target File Tree (COMPLETE — every file accounted for)

```
project-root/
│
├── .vscode/
│   ├── mcp.json                              ← MCP server config (VS Code)
│   └── settings.json                         ← Hook config (VS Code Copilot) [MERGED]
│
├── .github/
│   ├── agents/                               ← 7 Copilot agents (was 4)
│   │   ├── spec-engineer.agent.md            ← existing (Phases 2-3)
│   │   ├── design-architect.agent.md         ← existing (Phase 4)
│   │   ├── task-planner.agent.md             ← existing (Phase 5)
│   │   ├── spec-reviewer.agent.md            ← existing (Phases 2, 8)
│   │   ├── requirements-engineer.agent.md    ← existing (Pre-pipeline)
│   │   ├── sdd-init.agent.md                 ← NEW (Phase 0)
│   │   ├── sdd-clarify.agent.md              ← NEW (Phase 2)
│   │   ├── research-analyst.agent.md         ← NEW (Phase 1)
│   │   ├── implementer.agent.md              ← NEW (Phase 6)
│   │   ├── test-verifier.agent.md            ← NEW (Phase 7)
│   │   └── release-engineer.agent.md         ← NEW (Phase 9)
│   ├── hooks/
│   │   └── sdd-hooks.json                    ← Hook config (Copilot CLI/Cloud)
│   └── workflows/                            ← 10 GitHub Actions
│       ├── spec-sync.yml
│       ├── security-scan.yml                 ★ BLOCKING
│       ├── release-gate.yml                  ★ BLOCKING
│       ├── auto-checkpoint.yml
│       ├── spec-quality.yml
│       ├── task-tracer.yml
│       ├── ears-validator.yml
│       ├── drift-monitor.yml
│       ├── cognitive-debt-alert.yml
│       └── metrics-dashboard.yml
│
├── .claude/
│   ├── settings.json                         ← Hook config (Claude Code)
│   └── commands/                             ← 7 Claude Code commands
│       ├── sdd-requirements.md
│       ├── sdd-init.md
│       ├── sdd-research.md
│       ├── sdd-clarify.md
│       ├── sdd-implement.md
│       ├── sdd-test.md
│       └── sdd-release.md
│
├── .specky/
│   ├── config.yml                            ← Project config
│   ├── hooks/                                ← 10 SHARED shell scripts
│   │   ├── spec-sync.sh
│   │   ├── security-scan.sh                  ★ BLOCKING (exit 2)
│   │   ├── release-gate.sh                   ★ BLOCKING (exit 2)
│   │   ├── auto-checkpoint.sh
│   │   ├── spec-quality.sh
│   │   ├── task-tracer.sh
│   │   ├── ears-validator.sh
│   │   ├── drift-monitor.sh
│   │   ├── cognitive-debt-alert.sh
│   │   └── metrics-dashboard.sh
│   └── skills/                               ← 5 skills
│       ├── implementer/SKILL.md
│       ├── test-verifier/SKILL.md
│       ├── release-engineer/SKILL.md
│       ├── research-analyst/SKILL.md
│       └── sdd-markdown-standard/SKILL.md
│
├── install.sh                                ← One-click installer (10 steps)
├── INSTALL.md                                ← Complete guide + pipeline map
├── HOOKS-README.md                           ← 3-layer hooks reference
└── Specky_Plugin_Ecosystem_Blueprint.md      ← Full ecosystem blueprint
```

**Total: 50 files (7 agents + 7 commands + 5 skills + 10 hooks + 10 workflows + 3 hook configs + 1 MCP config + 1 project config + 1 installer + 5 docs)**

## Parity Checklist

Every row must have BOTH columns filled:

| Component | Claude Code | VS Code + Copilot |
|-----------|-------------|-------------------|
| MCP config | `claude mcp add` | `.vscode/mcp.json` |
| Agents | — (uses commands) | `.github/agents/*.agent.md` (7) |
| Commands | `.claude/commands/*.md` (7) | — (uses agents) |
| Skills | `.specky/skills/` (5, shared) | `.specky/skills/` (5, shared) |
| Hook scripts | `.specky/hooks/*.sh` (10, shared) | `.specky/hooks/*.sh` (10, shared) |
| Hook config JSON | `.claude/settings.json` | `.vscode/settings.json` + `.github/hooks/sdd-hooks.json` |
| CI/CD workflows | — (not applicable) | `.github/workflows/*.yml` (10) |
| Project config | `.specky/config.yml` (shared) | `.specky/config.yml` (shared) |

## Key Technical Details

### Hook scripts format (all 10 must follow this pattern):
```bash
#!/bin/bash
# {hook-name}.sh — {description}
# Type: {Advisory|BLOCKING} | Exit: {0|2}
# Events: {PreToolUse|PostToolUse|Stop|sessionEnd}
# Phase: {N}
# Paper: {arXiv reference}
set -euo pipefail
# ... logic ...
# Advisory: exit 0 always
# BLOCKING: exit 2 to block, exit 0 to allow
```

### Agent frontmatter format (GitHub Copilot):
```yaml
---
name: {agent-name}
description: "{description under 200 chars}"
model: {claude-opus-4-6|claude-sonnet-4-6|claude-haiku-4-5}
tools: ['{tool1}', '{tool2}']
thinking: {high|low}
handoffs:
  - label: "{handoff description}"
    agent: {next-agent}
    send: false
---
```

### Command format (Claude Code):
```yaml
---
name: {command-name}
description: "{description}. Use: /sdd:{name}"
mode: {ask|agent}
model: {model}
---
```

### Model routing per phase:
| Phase | Model | Thinking | Cost |
|-------|-------|----------|------|
| 0 Init | Haiku 4.5 | No | 0.33x |
| 1 Research | Sonnet 4.6 | No | 1x |
| 2 Clarify | Opus 4.6 | Yes | 3x |
| 3 Specify | Opus 4.6 | Yes | 3x |
| 4 Design | Opus 4.6 | Yes | 3x |
| 5 Tasks | Sonnet 4.6 | No | 1x |
| 6 Implement | Sonnet 4.6 | **No** | 1x |
| 7 Verify | Sonnet 4.6 | No | 1x |
| 8 Review | Opus 4.6 | Yes | 3x |
| 9 Release | Haiku 4.5 | No | 0.33x |

### The `sdd-markdown-standard` skill must be loaded by EVERY agent that writes to `.specs/`
This ensures all 11 spec artifacts follow the same format: YAML frontmatter (9 fields), Change Log table, TOC, numbered headings, EARS notation for requirements, REQ-ID format.

## Build Instructions

1. Create ALL files in the target tree above
2. For files marked "existing" — write placeholder content noting they exist in the Specky repo already
3. For NEW files — write complete content following the patterns above
4. Package everything into a single `specky-ecosystem-v1.0.0.zip`
5. Include `install.sh` that does all 10 steps
6. Test: verify `install.sh` would create/merge all 50 files correctly

## What NOT to do

- Do NOT auto-generate CLAUDE.md — per arXiv:2601.20404, LLM-generated AGENTS.md performs -3%
- Do NOT claim HTTP auth exists — planned for v2.4
- Do NOT claim RBAC exists — shipped in v3.2.0 but basic only
- Do NOT use extended thinking for Phase 6 (Implement) — arXiv:2502.08235: -30% quality, +43% cost
- Do NOT put hooks in `.claude/hooks/` — they go in `.specky/hooks/` (shared)
