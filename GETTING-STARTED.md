# Specky SDD Ecosystem — Getting Started

> **Spec-Driven Development** is the practice of writing formal specifications (in EARS notation) *before* writing code. Specky automates this 10-phase pipeline, ensuring full traceability from requirement to PR.

---

## Installation — Plugin (recommended)

The **plugin** is the enterprise-grade way to install Specky. It includes *everything*: MCP server, agents, prompts, skills, hooks, and configuration — version-controlled with your repo.

### Via Copilot CLI

```bash
copilot plugin install paulasilvatech/specky
```

Or via marketplace:

```bash
copilot plugin marketplace add paulasilvatech/specky   # one-time
copilot plugin install specky-sdd@specky
```

### Via script (any project)

```bash
cd your-project/
bash <(curl -sL https://raw.githubusercontent.com/paulasilvatech/specky/main/plugins/specky-sdd/install.sh)
```

The installer automatically configures:
- MCP server `specky-sdd` via npx → `.vscode/mcp.json`
- 7 Copilot agents → `.github/plugin/specky/agents/`
- 19 ready-to-use prompts → `.github/plugin/specky/prompts/`
- 6 shared skills → `.github/plugin/specky/skills/`
- 10 hook scripts → `.github/plugin/specky/hooks/scripts/`
- Copilot instructions → `.github/plugin/specky/instructions/`
- Pipeline config → `.github/plugin/specky/config.yml`
- VS Code hooks → `.vscode/settings.json`

> **Tip:** Commit `.github/plugin/` and `.vscode/` to Git so every team member gets Specky automatically on clone.

### Alternative Installation — MCP Server Only

If you only need the 57 MCP tools without agents, skills, and hooks:

```bash
npm install -g specky-sdd
```

Configure VS Code (`.vscode/mcp.json`):
```json
{
  "mcpServers": {
    "specky-sdd": {
      "type": "stdio",
      "command": "specky-sdd"
    }
  }
}
```

| | Plugin (recommended) | MCP Server Only |
|--|:-:|:-:|
| 57 MCP tools | ✅ | ✅ |
| 13 specialized agents | ✅ | — |
| 22 reusable prompts | ✅ | — |
| 8 domain skills | ✅ | — |
| 14 automation hooks | ✅ | — |
| EARS notation reference | ✅ | — |
| Model routing guidance | ✅ | — |
| Pipeline orchestrator | ✅ | — |
| Onboarding wizard | ✅ | — |
| `copilot plugin install` | ✅ | — |

---

## How to Invoke Specky

### VS Code + GitHub Copilot (@ agents + /prompts)
```
@specky-onboarding        → Interactive wizard (default entry point)
@specky-orchestrator      → Full pipeline coordinator
@sdd-init                 → Initialize pipeline
@requirements-engineer    → Extract FRD + NFRD
@research-analyst         → Research and discovery
@sdd-clarify              → Resolve ambiguities
@spec-engineer            → Write SPECIFICATION.md
@design-architect         → Write DESIGN.md + diagrams
@task-planner             → Write TASKS.md + CHECKLIST.md
@implementer              → Generate implementation plan
@test-verifier            → Verify test coverage
@quality-reviewer         → Completeness audit + compliance
@release-engineer         → Release checklist and PR
```

Ready-to-use prompts (slash commands):
```
/specky-greenfield        → New project from scratch
/specky-brownfield        → New feature in existing system
/specky-migration         → Legacy system migration
/specky-api               → API design
/specky-pipeline-status   → Current pipeline status
```

### Claude Code (slash commands)
```
/specky:greenfield        → New project from scratch
/specky:brownfield        → New feature in existing system
/specky:migration         → Legacy system migration
/specky:api               → API design
/specky:status            → Current pipeline status
```

---

## The SDD Pipeline — 10 Phases

```
[Pre-pipeline]
  requirements-engineer → Produces FRD.md + NFRD.md in docs/requirements/

[Phase 0] Init
  @sdd-init → Creates .specs/NNN-feature/ with CONSTITUTION.md

[Phase 1] Research
  @research-analyst → Scans codebase, imports docs, runs discovery → RESEARCH.md

[Phase 2] Clarify (optional but recommended)
  @sdd-clarify → Resolves EARS ambiguities, detects contradictions → CLARIFICATION-LOG.md

[Phase 3] Specify
  @spec-engineer → Writes complete SPECIFICATION.md in EARS notation

[Phase 4] Design
  @design-architect → Technical architecture, Mermaid diagrams, ADRs → DESIGN.md

[Phase 5] Tasks
  @task-planner → Breaks design into sequenced tasks → TASKS.md

[Phase 6] Implement ← Sonnet 4.6, WITHOUT extended thinking
  @implementer → Executes tasks with automatic git checkpoints

[Phase 7] Verify
  @test-verifier → Validates coverage against spec acceptance criteria

[Phase 8] Review
  Automatic hooks: drift-monitor, cognitive-debt-alert, metrics-dashboard

[Phase 9] Release ← Haiku 4.5
  @release-engineer → Security gates (BLOCKING) + PR creation
```

---

## Use Cases and Ready-to-Use Prompts

The prompts below are available in `.github/plugin/specky/prompts/` (Copilot) and `.claude/prompts/` (Claude Code).
Copy, fill in the fields between `[brackets]`, and submit.

---

### Starting a Project

#### Greenfield — New project from scratch
**When to use:** You have an idea or brief and want to build from scratch.
**Prompt:** `/specky-greenfield`

```
I want to start a greenfield project with Specky SDD.
Project: Contract management system
Description: Create, sign, and monitor digital contracts
Expected stack: Node.js + PostgreSQL + React
Timeline: MVP in 8 weeks
Compliance: GDPR
```
**What happens:** `requirements-engineer` → `sdd-init` → pipeline ready for research.

---

#### Brownfield — Feature in an existing system
**When to use:** You have a running system and want to add a new feature without breaking anything.
**Prompt:** `/specky-brownfield`

```
Feature: PDF report export
Existing system: Django ERP + PostgreSQL in production
Why now: Enterprise clients requesting it
Constraints: Must not impact the existing v2 API
```
**What happens:** `sdd_scan_codebase` detects stack → `requirements-engineer` considers legacy constraints → `sdd-init` initializes with `project_type: brownfield`.

---

#### Migration / Modernization
**When to use:** You need to migrate technologies or rewrite a legacy system.
**Prompt:** `/specky-migration`

```
Source: PHP 7.2 API + MySQL 5.7
Target: FastAPI + PostgreSQL + containers
Strategy: Strangler fig (migrate endpoint by endpoint)
Zero-downtime: yes
```

---

#### API Design
**When to use:** You're building or redesigning a public or internal API.
**Prompt:** `/specky-api`

```
Name: Payments API v2
Consumers: Mobile app + external partners
Protocol: REST
Authentication: OAuth2 (client credentials for partners, PKCE for mobile)
SLA: 99.99%
```

---

### Per Pipeline Phase

#### Phase 1 — Research
**Prompt:** `/specky-research`

Example with external documents:
```
Feature ID: 002-payment-gateway
Documents to import: docs/vendor/stripe-integration-guide.pdf, transcripts/discovery-call.vtt
Open questions: "Do we need to support ACH besides credit cards?"
```

---

#### Phase 2 — Clarify
**Prompt:** `/specky-clarify`

Example when the spec has known ambiguities:
```
Feature ID: 002-payment-gateway
Concerns: REQ-002-PAY-003 mentions "immediate confirmation" but
async payment can take minutes. This needs clarification.
```

---

#### Phase 3 — Specify
**Prompt:** `/specky-specify`

Example:
```
Domains that MUST be covered: Checkout, Refunds, Notifications, Audit
Out of scope: Recurring subscription management (deferred to v2)
```

---

#### Phase 4 — Design
**Prompt:** `/specky-design`

Example:
```
Constraints: Must use existing Redis for sessions, deploy on AWS ECS
Preferred patterns: Hexagonal Architecture
```

---

#### Phase 5 — Tasks
**Prompt:** `/specky-tasks`

Example:
```
Team: 3 devs
Sprint: 2 weeks
Parallelization: maximum — mark [P] where safe
P0 (MVP): basic checkout with credit card. ACH is P1.
```

---

#### Phase 6 — Implement
**Prompt:** `/specky-implement`

Example:
```
Task: TASK-006-3: Implement POST /payments endpoint
Environment: devcontainer with local PostgreSQL and Stripe test mode
```

---

#### Phase 7 — Verify
**Prompt:** `/specky-verify`

Example:
```
Current coverage: 71% unit
Criteria that concern me: gateway timeout scenario (REQ-002-PAY-009)
```

---

#### Phase 9 — Release
**Prompt:** `/specky-release`

Example:
```
Branch: spec/002-payment-gateway
Target: develop (then stage → main after gates pass)
Deploy: canary (10% → 50% → 100% over 24h)
Observability: Grafana dashboards already configured
```

---

### Special Cases

#### Extract requirements from a Figma design
**When to use:** The designer delivered a Figma and you want to turn the flows into EARS requirements.
**Prompt:** `/specky-from-figma`

```
URL: https://figma.com/file/ABC123/Checkout-Flow-v2
Context: 4 screens — cart, address, payment, confirmation
Still needs defining: shipping rules, session timeout, API error states
```

**Important:** Figma covers happy paths. Specky will automatically identify edge cases not mapped in the design (errors, timeouts, empty states) and generate questions to fill them.

---

#### Turn a meeting transcript into requirements
**When to use:** You had a discovery meeting and want to extract requirements from the discussion.
**Prompt:** `/specky-from-meeting`

```
File: transcripts/sprint-planning-2026-04-13.vtt
Type: Stakeholder discovery
Participants: Ana (PO — final decision), Carlos (CTO), dev team
Decisions I remember: "ACH is P1, not MVP" and "must integrate with existing Stripe"
```

**What happens:** Specky imports the transcript, extracts decisions vs. open questions, validates your memories against what was actually said, and produces RESEARCH.md with everything documented.

---

#### Check drift between code and spec
**When to use:** A few weeks have passed, scope changed, and you want to know if the code still aligns with the spec.
**Prompt:** `/specky-check-drift`

```
Feature ID: 001-user-authentication
Reason: We added rate limiting last sprint without updating the spec
Files that changed: src/auth/middleware.ts, src/auth/session.ts
```

---

#### Resolve a conflict between two requirements
**When to use:** Two requirements contradict each other and you need a documented decision.
**Prompt:** `/specky-resolve-conflict`

```
REQ A: REQ-001-AUTH-007 — "Sessions expire after 30 minutes of inactivity"
REQ B: REQ-001-AUTH-012 — "Users remain logged in for 7 days"
Hypothesis: Perhaps these apply to different roles (admin vs. regular user)?
```

---

### Troubleshooting

#### Hook blocking the workflow
**Prompt:** `/specky-debug-hook`

Most common issues:
| Symptom | Likely cause | Quick fix |
|---------|-------------|-----------|
| `security-scan.sh` blocking | String "api_key" in example spec | Rename to `API_KEY_EXAMPLE` or move to a comment |
| `release-gate.sh` blocking | Missing DESIGN.md | Complete Phase 4 before release |
| Hook not firing | Invalid JSON in settings.json | `cat .vscode/settings.json \| python3 -m json.tool` |
| Hook not firing in VS Code | Settings not reloaded | Ctrl+Shift+P → "Reload Window" |

---

#### Check pipeline status
**Prompt:** `/specky-pipeline-status`

Use when: You came back from vacation and don't know where a feature was. Or you want to see all active features for a team.

---

#### Return to a previous phase
**Prompt:** `/specky-reset-phase`

**When to use:** Requirements changed mid-implementation. Specky creates a git snapshot before any rollback so you don't lose work.

---

## Model Routing by Phase

| Phase | Agent | Model | Thinking | Why |
|-------|-------|-------|----------|-----|
| Pre / 0 | requirements-engineer / sdd-init | Opus 4.6 / Haiku 4.5 | Opus: yes / Haiku: no | Requirements = highest leverage; init = pure scaffolding |
| 1 | research-analyst | Sonnet 4.6 | No | Information synthesis, not deep reasoning |
| 2 | sdd-clarify | Opus 4.6 | Yes | Ambiguity requires deep reasoning |
| 3 | spec-engineer | Opus 4.6 | Yes | Specification is the most critical phase |
| 4 | design-architect | Opus 4.6 | Yes | Architectural decisions have long-term impact |
| 5 | task-planner | Sonnet 4.6 | No | Structured decomposition, not reasoning |
| 6 | implementer | Sonnet 4.6 | **No** ⚠️ | arXiv:2502.08235: thinking during implementation = -30% quality, +43% cost |
| 7 | test-verifier | Sonnet 4.6 | No | Iterative verification with executable feedback |
| 8 | (automatic hooks) | — | — | drift-monitor, metrics, cognitive-debt |
| 9 | release-engineer | Haiku 4.5 | No | Mechanical checklist, 0.33x cost |

---

## Hooks: What They Do Automatically

You don't need to call these hooks — they fire automatically on the right events.

| Hook | When it fires | What it does |
|------|--------------|-------------|
| `security-scan.sh` ★ BLOCKING | Before creating PR / end of session | Scans for secrets in `.specs/` |
| `release-gate.sh` ★ BLOCKING | Before creating PR | Validates all artifacts exist |
| `spec-sync.sh` | After Write/Edit on specs | Detects drift between artifacts |
| `auto-checkpoint.sh` | After Write/Edit on specs | Creates automatic git commit |
| `spec-quality.sh` | After writing spec | EARS quality score |
| `ears-validator.sh` | After writing spec | Validates EARS notation |
| `task-tracer.sh` | After writing tasks | Validates REQ ↔ Task traceability |
| `drift-monitor.sh` | After cross-analysis | Code vs. spec comparison |
| `cognitive-debt-alert.sh` | After cross-analysis | Alerts if spec became too complex |
| `metrics-dashboard.sh` | After cross-analysis | Consolidates metrics into dashboard.json |

---

## FAQ

**Q: Do I need to use all 10 phases?**
A: No. For small features, you can go Init → Specify → Tasks → Implement → Release. The Clarify, Design, and Review phases are highly recommended but not blocking. The Research phase is mandatory for brownfield projects.

**Q: What is EARS notation?**
A: Easy Approach to Requirements Syntax — 6 patterns for writing requirements that eliminate ambiguity:
- *Ubiquitous:* "The system shall..."
- *Event-driven:* "When [trigger], the system shall..."
- *State-driven:* "While [state], the system shall..."
- *Optional:* "Where [feature] is included, the system shall..."
- *Unwanted behavior:* "If [condition], then the system shall..."
- *Complex:* "While [state], when [event], the system shall..."

**Q: Why no extended thinking during implementation?**
A: arXiv:2502.08235 demonstrated that extended thinking during implementation phases reduces quality by 30% and increases cost by 43%. Thinking is reserved for reasoning phases (Clarify, Specify, Design) where the cost-benefit ratio is positive.

**Q: Can I use Specky without GitHub?**
A: Yes. The `.github/plugin/specky/agents/` and `.github/workflows/` require GitHub Copilot and GitHub Actions. But you can use Claude Code with `.claude/commands/` and `.specky/hooks/` without any GitHub dependency.

**Q: Does Specky write the code for me?**
A: The `@implementer` (Phase 6) generates detailed implementation plans, test stubs, and IaC scaffolding. The production code is written by your IDE's AI tool (Claude Code, Copilot) following the plan generated by Specky. Specky ensures that what is implemented matches exactly what was specified.

---

## Next Steps

1. Install the plugin: `copilot plugin install paulasilvatech/specky`
2. Or install manually: `bash <(curl -sL https://raw.githubusercontent.com/paulasilvatech/specky/main/plugins/specky-sdd/install.sh)`
3. Start with `/specky-pipeline-status` to see if there are active features, or
4. Use `/specky-greenfield` (new project) or `/specky-brownfield` (existing feature) to begin
5. Refer to this guide whenever you're unsure which prompt to use

Plugin documentation: [`plugins/specky-sdd/README.md`](plugins/specky-sdd/README.md) | Changelog: [`CHANGELOG.md`](CHANGELOG.md) | Security: [`SECURITY.md`](SECURITY.md)
