# SDD Spec Engineer v3.0 — Claude Code Project Instructions

**Auto-loaded by Claude Code when working in this directory.**

---

## 1. Project Overview

SDD Spec Engineer v3.0 is a **Spec-Driven Development system** that enforces traceability between requirements, design, implementation, and tests. It uses EARS notation for requirement statements, maintains quality gates at every phase, and includes 4 specialized Custom Agents plus 6 automation hooks.

**Goal:** Close the gap between specification and code through continuous validation, preventing drift and ensuring acceptance criteria are met.

---

## 2. Available Commands

Use these `/sdd:*` commands in Claude Code to invoke specialized workflows:

| Command | Agent | Purpose | Output |
|---------|-------|---------|--------|
| `/sdd:spec` | Spec Engineer | Write or refine requirements in EARS notation | `.specs/NNN-feature/SPECIFICATION.md` |
| `/sdd:design` | Design Architect | Create architecture and interface design | `.specs/NNN-feature/DESIGN.md` |
| `/sdd:tasks` | Task Planner | Break specification into implementation tasks | `.specs/NNN-feature/TASKS.md` |
| `/sdd:analyze` | Spec Reviewer | Audit spec for ambiguity, completeness, traceability | `reports/spec-analysis.md` |
| `/sdd:bugfix` | Spec Reviewer | Link bugs to failing acceptance criteria | `reports/bugfix-trace.md` |

---

## 3. Model Routing Table

**Choose the right model for each phase:**

| Phase | Model | Reason | Max Tokens |
|-------|-------|--------|-----------|
| Specification (EARS writing) | claude-opus-4 | High quality, long context | 8000 |
| Design (architecture, UML) | claude-opus-4 | Structural reasoning | 8000 |
| Task planning (decomposition) | claude-sonnet-4 | Fast, sufficient for planning | 4000 |
| Code review / SRP validation | claude-haiku-3.5 | Lightweight structural analysis | 3000 |
| Specification audit | claude-opus-4 | Complex traceability logic | 6000 |
| Hooks (test, docs, security, sync) | claude-haiku-3.5 | Deterministic, repetitive work | 2000-3000 |

---

## 4. File Structure

```
sdd-spec-engineer/
├── .specs/
│   └── 001-user-login/              # Feature directory (numbered)
│       ├── SPECIFICATION.md         # EARS requirements (canonical)
│       ├── DESIGN.md                # Architecture & interfaces
│       ├── TASKS.md                 # Implementation breakdown
│       └── ACCEPTANCE_CRITERIA.md   # Traceability to tests
├── hooks/                           # 6 automation hooks
│   ├── auto-test.md
│   ├── auto-docs.md
│   ├── security-scan.md
│   ├── spec-sync.md
│   ├── changelog.md
│   └── srp-validator.md
├── agents/                          # 4 Custom Agent definitions (GitHub Copilot)
│   ├── spec-engineer.agent.md
│   ├── design-architect.agent.md
│   ├── task-planner.agent.md
│   └── spec-reviewer.agent.md
├── .claude/
│   └── commands/                    # Claude Code command definitions
│       ├── sdd-spec.md
│       ├── sdd-design.md
│       ├── sdd-tasks.md
│       ├── sdd-analyze.md
│       └── sdd-bugfix.md
├── reports/                         # Generated reports
│   ├── spec-analysis.md
│   ├── traceability/
│   ├── code-quality/
│   ├── security/
│   └── bugfix-trace.md
├── references/                      # Reference templates & guides
│   ├── ears-notation.md             # EARS syntax & examples
│   ├── spec-templates.md            # Specification boilerplate
│   └── design-patterns.md           # Architecture templates
├── CLAUDE.md                        # This file (auto-loaded)
└── apm.yml                          # APM manifest for distribution
```

---

## 5. Working Rules

### Positive Framing Only
- Write specs in **can do, will do** language, not "shall not"
- Frame requirements as capabilities, not restrictions
- Example: "The system **validates** user input" not "The system **rejects invalid** input"

### Anti-Over-Engineering: Start Simple
- Begin with the simplest approach that meets acceptance criteria
- Refactor later if complexity justifies it
- Avoid premature abstraction; let patterns emerge

### Progressive Context Loading
- Read reference files **per phase**, not all at once
- Load EARS notation guide before writing specs
- Load design patterns before writing architecture
- Load task templates before decomposing work

### Phase Pause for LGTM (Looks Good To Me)
- After completing each phase (spec, design, tasks), **pause and wait for approval**
- Example: "Spec draft complete. Review `.specs/001-feature/SPECIFICATION.md` and reply LGTM when ready to proceed to Design."
- Do not proceed without explicit LGTM from user

### Default to Action on LGTM
- Once user replies **LGTM**, proceed immediately with next phase
- No need to re-ask for permission
- This accelerates workflow while maintaining quality gates

### Feature Numbering Convention
- All features live in `.specs/NNN-feature-name/` where NNN is zero-padded (001, 002, etc.)
- Use kebab-case for feature names: `001-user-login`, `002-payment-gateway`
- Each directory is a complete, self-contained specification package

### All Specs in English
- All specification, design, and acceptance criteria documents written in English
- Code comments and docstrings may be in other languages if client prefers
- Reports always in English for consistency

---

## 6. Reference Files & Guides

**Available in `references/` directory:**

- **ears-notation.md** — Complete EARS syntax with examples (load before `/sdd:spec`)
- **spec-templates.md** — Boilerplate for common feature types (user flows, integrations, data models)
- **design-patterns.md** — Architecture patterns & interface templates for design phase

Load these progressively — don't read all at once.

---

## 7. Agents & GitHub Copilot Integration

Four Custom Agents available in `agents/` directory for GitHub Copilot:

1. **spec-engineer.agent.md** — Writes EARS requirements, validates completeness
2. **design-architect.agent.md** — Creates system architecture, interface design, UML
3. **task-planner.agent.md** — Decomposes specs into implementation tasks
4. **spec-reviewer.agent.md** — Audits specs for quality, finds ambiguity and drift

Use in Copilot Chat with: `@spec-engineer [prompt]` (or any of the 4 agents)

---

## 8. Hooks & Automation

Six hooks run automatically after code changes or task completion (see `hooks/` directory):

| Hook | Trigger | Action |
|------|---------|--------|
| **auto-test** | Task completion | Generate test stubs from acceptance criteria |
| **auto-docs** | Code changes | Update README, API docs to match implementation |
| **security-scan** | Pre-merge | OWASP Top 10 + secrets check |
| **spec-sync** | Code changes | Flag spec-code drift in SYNC_REPORT.md |
| **changelog** | Release tag | Generate CHANGELOG.md entry |
| **srp-validator** | Code changes | Flag SRP violations; suggest decomposition |

All hooks use **claude-haiku-3.5** for speed and determinism. Hooks run asynchronously and log results in `reports/`.

---

## 9. Traceability & Quality Gates

### Acceptance Criteria Traceability
Every task must have acceptance criteria mapped to:
1. **Specification requirement** (EARS statement)
2. **Design component** (interface or module)
3. **Test case** (acceptance test stub)
4. **Code location** (file, function, line)

### Quality Gates
- **Specification phase:** Completeness audit (no orphaned criteria)
- **Design phase:** No missing interfaces or design documents
- **Implementation phase:** Auto-test, auto-docs, security-scan hooks pass
- **Merge gate:** spec-sync report shows zero drift

---

## 10. Spec-Kit Compatibility

[**Spec-Kit**](https://github.com/github/spec-kit) is optional but recommended for CLI scaffolding and Git branch management.

**To initialize a feature with spec-kit:**
```bash
specify init --template=sdd-spec-engineer 001-my-feature
```

This auto-scaffolds `.specs/001-my-feature/` with SPECIFICATION.md, DESIGN.md, TASKS.md, and git branch setup.

---

## 11. Quick Start

1. **Create a feature directory:**
   ```bash
   mkdir -p .specs/001-my-feature
   ```

2. **Start specification:**
   ```
   /sdd:spec
   ```
   → Creates SPECIFICATION.md in EARS notation

3. **Wait for LGTM**, then proceed to design:
   ```
   /sdd:design
   ```
   → Creates DESIGN.md with architecture

4. **Wait for LGTM**, then break down tasks:
   ```
   /sdd:tasks
   ```
   → Creates TASKS.md with implementation plan

5. **Implement** and let hooks run automatically (spec-sync, auto-test, auto-docs, security-scan)

6. **Before releasing:**
   ```
   /sdd:analyze
   ```
   → Audit spec completeness and traceability

---

## 12. Environment Variables & Config

Optional configuration in `.env` or in hook definitions:

```bash
SDD_MODEL_SPEC=claude-opus-4            # Specification model
SDD_MODEL_DESIGN=claude-opus-4          # Design model
SDD_MODEL_TASKS=claude-sonnet-4         # Task planning model
SDD_HOOK_AUTO_TEST=true                   # Enable auto-test hook
SDD_HOOK_SECURITY_SCAN=true               # Enable security scanning
```

---

## 13. Support & Resources

- **EARS Notation Guide:** `references/ears-notation.md`
- **Specification Examples:** `references/spec-templates.md`
- **Design Patterns:** `references/design-patterns.md`
- **APM Distribution:** See `apm.yml` for package structure
- **GitHub Integration:** Agents in `agents/` work with GitHub Copilot

---

## 14. Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2026-03-20 | Initial release: 4 agents, 6 hooks, EARS notation, quality gates |

---

**Last Updated:** 2026-03-20
**Maintainer:** Paula Silva
**License:** MIT
