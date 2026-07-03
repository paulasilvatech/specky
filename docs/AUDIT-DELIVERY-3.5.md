# Promise-Delivery Audit — Specky 3.5.0

> **Date:** 2026-07-03 · **Version audited:** `specky-sdd@3.5.0` (built `dist/` from this tree)
> **Method:** black-box execution of the real server and CLI — no claim was accepted from documentation or source reading alone.
> **Scope:** 65 public product promises (README, tool descriptions, release notes) across 7 categories.
> **Verdicts:** 30 delivered · 29 partial · 6 not delivered.

This document is the honest public record of what version 3.5.0 actually delivers when executed. It favors accuracy over flattery. A companion remediation effort (see §6) is fixing the partial and not-delivered findings for the next release.

---

## 1. Methodology

Seven independent auditors executed the **real built server** (`node dist/index.js --http`, ports 3301–3307, each against a fresh `SDD_WORKSPACE` in a temp directory) and drove it over **MCP JSON-RPC over HTTP** — the same protocol a real AI client uses. The CLI auditor ran `node dist/cli/index.js` in fresh git-initialized directories.

Ground rules applied by every auditor:

- **Pipelines were driven for real.** Where a tool is phase-gated, the auditor advanced the actual state machine (`sdd_init → sdd_discover → sdd_write_spec → sdd_clarify → sdd_write_design → sdd_write_tasks → sdd_run_analysis → …`) with genuine content (EARS requirements, Mermaid diagrams, ADRs, traced tasks) until the tool's phase was legitimately reached. Quality gates were *earned* (e.g. a real BLOCK at 50% coverage remediated to APPROVE at 100% by editing artifacts), never bypassed.
- **Artifacts were read back from disk.** Every claim of "writes X" was verified by reading the file from the workspace after the call — byte sizes, content, and mtimes — not by trusting the tool's JSON response.
- **Outputs were validated in their own ecosystems** where possible: generated Mermaid through a Mermaid parser, generated Python through `py_compile`, generated Java through `javac`, generated JSON through `JSON.parse`, the npm tarball through `npm pack --dry-run`, hooks by direct execution against live git state, and the fast-check import claim against the real installed `fast-check` package.
- **Verdict scale:** **delivered** (the promise holds as advertised), **partial** (the mechanism is real but materially short of the promise), **not delivered** (the advertised capability does not work in any realistic configuration).

Every finding below carries the evidence observed during execution and, for partial/not-delivered verdicts, the specific gap.

---

## 2. Scoreboard

| Category | Tested | Delivered | Partial | Not delivered |
|---|---:|---:|---:|---:|
| Tool registry & pipeline engine | 8 | 5 | 3 | 0 |
| Diagrams & visualization | 6 | 2 | 4 | 0 |
| Documentation generation & checkpoints | 8 | 3 | 5 | 0 |
| Test generation & environments | 12 | 1 | 6 | 5 |
| Quality, compliance & intelligence | 8 | 3 | 5 | 0 |
| CLI toolkit & installed assets | 11 | 10 | 1 | 0 |
| Input formats & MCP-to-MCP integration | 12 | 6 | 5 | 1 |
| **Total** | **65** | **30** | **29** | **6** |

Reading the table honestly: the **engine, CLI, and plumbing are real** — phase enforcement, computed quality gates, EARS validation, installers, hooks, checkpoints, and routing payloads all survived execution. The weaknesses concentrate in **content generators** (tests, IaC, docs, several diagram types) that produce scaffolds, boilerplate, or in some cases output that fails its own language's parser, and in **persisted reports** that ship with unrendered template placeholders.

---

## 3. Delivered promises (30)

### Tool registry & pipeline engine
- **58 MCP tools** — `tools/list` over MCP HTTP returns exactly 58 tools, `sdd_init` through `sdd_verify_audit`.
- **Phase gating blocks out-of-phase tools** — in a fresh workspace, `sdd_write_design`, `sdd_run_analysis`, and `sdd_write_tasks` all return structured `phase_validation_failed` errors naming the current phase, allowed phases, and a fix hint; nothing is written to disk by blocked calls.
- **Each phase produces its real artifact on disk** — the full pipeline driven over MCP produced substantive (non-scaffold) CONSTITUTION.md, SPECIFICATION.md (with the auditor's EARS text and acceptance-criteria table), DESIGN.md (with the supplied Mermaid and ADR), TASKS.md, and ANALYSIS.md (real traceability matrix), plus the 7-file companion spec package.
- **EARS validation, 6 patterns, programmatic** — `sdd_validate_ears` classified one requirement per pattern (ubiquitous, event_driven, state_driven, optional, unwanted, complex) exactly right, flagged a vague requirement as invalid with issues, and computed the correct compliance rate (6/7 = 86).
- **The quality gate is computed, not asserted** — `sdd_run_analysis` returned BLOCK at 50% coverage with per-requirement gaps on an untraced package, hard-blocked `sdd_advance_phase`, then recomputed to APPROVE/100% after real mappings were added to DESIGN.md and TASKS.md on disk.

### Diagrams & visualization
- **The `sdd_generate_diagram` schema enumerates 17 diagram types** covering every advertised category, including all 4 C4 levels, DFD, deployment, and network topology, plus a `source` enum of spec/design/tasks/constitution.
- **All 17 types execute successfully** — 34 calls (17 types × 2 sources) against a driven pipeline all returned non-empty `mermaid_code` with the correct Mermaid header per type.

### Documentation generation & checkpoints
- **The pipeline is drivable to Verify for the docs tools** — init through analyze (gate APPROVE, 100% coverage) to implement and verify, all over MCP, with every intermediate artifact verified on disk.
- **The SDD Journey document is genuinely data-driven** — `docs/journey-001.md` contains real per-phase ISO timestamps for the 9 traversed phases, the actual APPROVE/100% gate decision with its `decided_at`, true requirement/task counts (3/4), artifact sizes, and the two real ADR titles from the design.
- **Checkpoints give a true roundtrip restore** — `sdd_checkpoint` snapshotted 6 artifacts with full contents; after tampering two artifacts, `sdd_restore` restored both byte-identically (verified by byte-compare) and created a CP-AUTO-BACKUP capturing the tampered state.

### Test generation & environments
- **`sdd_generate_dockerfile` works as advertised** — correct tech-stack detection from DESIGN.md (TypeScript/Express/node22), a genuine multi-stage `node:22-slim` Dockerfile (npm ci, build, slim runtime, EXPOSE, CMD), a valid docker-compose.yml, and a sensible .dockerignore.

### Quality, compliance & intelligence
- **Intent drift detection with amendment suggestions** — drift scores computed from real artifact text moved with input (100 → 67 as spec coverage of constitutional principles changed), orphaned-principle lists named the exact injected headings, drift history persisted, and `sdd_amend` returned concrete, principle-specific amendment actions.
- **Model routing decision table** — `sdd_model_routing` returns a coherent table covering exactly the 10 pipeline phases with per-phase model, fallback chain, thinking flag, rationale, and a cost analysis that scales linearly with team size (49% savings vs. opus-only in abstract premium units, as documented).
- **Context tiering with computed token savings** — `sdd_context_status` assigns all 10 artifacts to hot/domain/cold tiers with token numbers verified to derive from actual file bytes (a 317-byte CONSTITUTION.md reported exactly ceil(317/4) = 80 hot tokens); totals and savings moved across workspaces with content.

### CLI toolkit & installed assets
- **`specky install --ide=copilot`** installs exactly 13 agents / 22 prompts / 8 skills / 16 hooks with substantive (non-stub) content, plus `.vscode/mcp.json` and an install manifest.
- **`specky install --ide=claude`** installs 13 agents / 22 commands / 8 skills / 16 hook scripts; `.mcp.json` pins `specky-sdd@3.5.0` — version-pinned, no `@latest`.
- **`.claude/settings.json` permissions are least-privilege** — 11 allow rules; no `Bash(rm:*)`, no `WebFetch`, no bare `Bash(bash:*)` or `Bash(*)`.
- **`specky doctor` integrity checking works end to end** — healthy exit 0 on fresh install; a corrupted hook detected by name with exit 1; `doctor --fix` restores it; healthy again.
- **`specky status` and `specky hooks list`** report accurate live versions, asset counts, and pipeline state.
- **`specky upgrade` preserves user data** — `.specs/` content byte-identical after upgrade while a tampered installed asset was restored.
- **Hooks are real executable enforcement** — `branch-validator.sh` warns (exit 0) in advisory mode and hard-blocks (exit 2) under `SPECKY_GUARD=strict` against live git state; `security-scan.sh` blocks (exit 2) on a real staged AWS-key pattern with file:line output; `session-banner.sh` prints an accurate pipeline banner.
- **`specky --version`** prints `specky v3.5.0`.
- **The legacy `npx specky-sdd` entry routes to serve** — a bin named `specky-sdd` with no subcommand boots a working stdio MCP server that answers `initialize` with `{name:'specky', version:'3.5.0'}`.
- **The npm tarball ships everything** — `npm pack --dry-run`: 488 files including `.apm/` (63), `templates/` (22), `dist/` (396), matching the installer's source assets exactly.

### Input formats & MCP-to-MCP integration
- **Meeting transcripts (VTT and SRT)** — `sdd_import_transcript` genuinely extracted participants, decisions, requirements, and constraints from crafted Teams-style VTT and Zoom-style SRT content, and is correctly phase-gated.
- **Markdown/plain-text/raw-text documents** — `sdd_import_document` returned correct format detection, word counts, and verbatim content; `sdd_batch_import` processed a directory of 8 files with per-file metadata.
- **Codebase scan (brownfield)** — `sdd_scan_codebase` returned an accurate recursive file tree and correct tech-stack detection (TypeScript/Express/npm/Node.js) from a seeded project.
- **Raw text to spec package** — `sdd_turnkey_spec` produced 7 EARS-valid requirements spanning all 5 patterns, each traceable to an input sentence, wrote a 10-file package, and the state machine honestly refused to advance past its scaffold DESIGN/TASKS until they were completed.
- **`sdd_create_branch` / `sdd_create_pr` are data-only and gated** — routing payloads with full REQ traceability, zero git side effects (verified against the live repo), phase-gate enforced, and the RBAC release gate blocked a contributor from `create_pr` while `sdd_check_access` reported the active role correctly.
- **`sdd_check_ecosystem` / `sdd_check_sync` / `sdd_amend` / `sdd_write_bugfix`** all executed with real behavior: concrete MCP server recommendations tied to the tools they enhance, an honest code-drift report, a persisted constitutional amendment (Amendment Log row + state), and a fully populated BUGFIX_SPEC.md.

---

## 4. Partial findings (29)

Each finding lists what was promised, what execution showed, and the specific gap.

### Tool registry & pipeline engine

**P-01 — "No phase-skipping" is only enforced once a feature is registered** (`sdd_advance_phase`)
*Evidence:* With a registered feature the guard is real — advancing from specify without SPECIFICATION.md was rejected with "Cannot advance: missing required files". But in a workspace where `sdd_init` was never run, repeated `sdd_advance_phase` calls advanced init → discover → specify → clarify → design → tasks → analyze — six phase transitions with zero artifacts on disk — because the required-file check is silently skipped when `state.features` is empty. Only the Analyze gate stopped it.
*Gap:* Enforcement is per-feature, not per-workspace; the absolute "no phase-skipping" claim only holds after `sdd_init` has registered a feature.

**P-02 — LGTM gates are artifact checks plus instrumentation, not enforced human review** (`sdd_advance_phase`)
*Evidence:* Advancing validates the completed phase's required file exists and is not a scaffold, and appends a GateHistoryEntry (with `was_modified` cognitive-debt instrumentation) to `.specs/.sdd-state.json` — verified for specify/design/tasks. The only hard computed gate is at Analyze.
*Gap:* No server-side approval token exists at the Specify/Design/Tasks gates; a script advanced through all three instantly with zero human review. The "AI pauses for LGTM" behavior is an agent-layer prompt convention, not engine enforcement.

**P-03 — `sdd_get_status` headline fields go stale for pipelines driven through the actual tools**
*Evidence:* Status was called at init, specify, analyze, and implement. The primary fields never moved — `current_phase: 'init'`, 0/10 phases, `completion_percent: 0`, `gate_decision: null` — even while the pipeline was verifiably at implement with gate APPROVE persisted in the root `.specs/.sdd-state.json`. Cause observed on disk: the tool prefers a per-feature state file (`.specs/<feature>/.sdd-state.json`) that no pipeline tool ever writes, and silently falls back to a default fresh state. The true progression (implement, 70%) appears only in the secondary `phase_context` field, producing a self-contradictory response.
*Gap:* The headline fields the tool promises are wrong for any real MCP-driven pipeline; existing integration tests mask this by hand-writing the state file into both locations.

### Diagrams & visualization

**P-04 — Not all 17 diagram types emit content actually derived from the artifacts** (`sdd_generate_diagram`)
*Evidence:* All 34 outputs (17 types × spec/design sources) were read in full and suspicious ones run through a Mermaid parser. Roughly 6–7 types are genuinely spec-derived and valid (flowchart, activity, use_case, c4_container, c4_component, mindmap, gantt-from-tasks).
*Gap:* (1) `er` and `dfd` from the spec source emit **syntactically invalid Mermaid** — parse errors on entity/node ids containing `:` and `()`. (2) `class`, `state`, and `c4_code` are constant hardcoded stubs identical for both sources (e.g. `class` is always a 49-char `class Service {+execute()}`). (3) Design-source `use_case` invents Login/Dashboard/Export use cases that appear nowhere in the design; design-source `pie` carries fabricated 60/25/15 percentages; `gantt` from spec/design is header-only. (4) Spec-source `sequence` is valid but semantically garbled naive verb extraction (`shall->>an: shall send an`). A material fraction of the "17 types" are static templates or unrenderable output.

**P-05 — `sdd_generate_all_diagrams` returns 16 diagrams but writes nothing to disk**
*Evidence:* One call returned 16 diagrams spanning all four sources, including a genuinely content-derived gantt and task-dependency flowchart from TASKS.md. But DIAGRAMS.md's mtime was unchanged before/after the call, and `src/tools/visualization.ts` contains zero file writes; the on-disk DIAGRAMS.md is a 775-byte scaffold from `sdd_write_spec` with just 2 diagrams and a TODO list.
*Gap:* No persistence; the set is also 16, not 17 (no c4_context, no state), and inherits the stub-quality class/er/c4_code diagrams.

**P-06 — `sdd_generate_user_stories` has real traceability but broken story prose**
*Evidence:* 5 stories, exactly one per requirement, with REQ-ORD-001..005 all present, EARS-pattern-based priorities, acceptance criteria copied from the spec, per-story flow diagrams, and a roll-up journey flowchart.
*Gap:* Every title is just the EARS pattern in parens ("(event_driven)") and every description reads "As a user, I want (event_driven) so that the system meets this requirement" — the actual requirement text never reaches the as-a/I-want clause. Acceptance-criteria arrays contain stray `**` markdown artifacts.

**P-07 — `sdd_figma_diagram` payloads are well-formed but barely differentiated by type**
*Evidence:* All 4 types (architecture, user_flow, data_flow, integration) returned the documented FigJam routing payload with typed nodes and connections, real DESIGN.md content as labels, and routing instructions targeting Figma MCP's `generate_diagram`.
*Gap:* architecture and data_flow payloads are byte-identical node sets; user_flow and integration differ only by one prepended "User" node. All connections are a linear chain uniformly labeled "connects to", and nodes are DESIGN.md section headings in document order (including "10. Architecture Decision Records" as a "component") — no real topology.

### Documentation generation & checkpoints

**P-08 — `sdd_generate_docs` output contains zero actual requirement text**
*Evidence:* Wrote `docs/001-todo-api.md` (3,142 B) with 5 sections, embedding the real gate decision (APPROVE, 100%) and feature identity.
*Gap:* The `summarize()` helper takes only the first 15 non-empty lines of each artifact — for SPECIFICATION.md that is YAML frontmatter plus table of contents, so the combined doc contains no requirement text at all (`grep -c 'shall'` = 0 despite three full EARS requirements in the spec). The Implementation Plan section shows a task-table header with no rows; "How It Was Built" is static boilerplate.

**P-09 — `sdd_generate_all_docs`: all 5 files written, but "5 types via Promise.all" is overstated and depth varies sharply**
*Evidence:* One call returned `total_generated=5` and all five files verified on disk (full, api, runbook, onboarding, journey); the file writes are `Promise.all`'d.
*Gap:* Only 4 of the 5 *generations* run inside the `Promise.all` (`src/services/doc-generator.ts`); the journey doc is generated sequentially afterward inside a try/catch that silently drops it on error. Content depth: journey is genuinely data-driven, runbook is fully static, and full/onboarding/api omit the requirement text and API schemas (P-08, P-10, P-11).

**P-10 — `sdd_generate_api_docs` is an endpoint inventory, not API documentation**
*Evidence:* The endpoints are real and extracted from the driven DESIGN.md — POST/GET/PUT/DELETE /todos each get a section with Request/Response blocks.
*Gap:* Every request/response example is an empty `{}` placeholder even though DESIGN.md contains the supplied JSON schemas — the extractor captures only METHOD+PATH and never reads contract bodies. `POST /todos` appears twice (the regex also matched it inside a Mermaid sequence diagram), and "descriptions" are just the method+path repeated.

**P-11 — `sdd_generate_runbook` is 100% static boilerplate**
*Evidence:* All four advertised sections present (deployment, monitoring, troubleshooting, rollback); feature name and timestamp are real.
*Gap:* The entire body is a hardcoded template — the generator reads DESIGN.md and discards the result. The troubleshooting rows ("Database connection", "Token expiry") are unrelated to the actual feature; the same runbook would be produced for any project.

**P-12 — `sdd_generate_onboarding` teaches a new developer nothing about the feature**
*Evidence:* All 5 advertised sections written with correct `.specs/` paths, and the architecture excerpt contains actual design text.
*Gap:* "What This Feature Does" is the first 500 chars of the same naive 15-line summary — frontmatter plus a table of contents cut off mid-line — with no requirement text; Getting Started and Key Concepts are static boilerplate identical for every feature.

### Test generation & environments

**P-13 — vitest/jest/playwright generation works but emits markdown-parsing garbage as tests** (`sdd_generate_tests`)
*Evidence:* All three frameworks returned `tests_generated` and wrote real files with correct per-framework idioms (vitest/jest imports and globals, `@playwright/test` with `async ({ page })`), requirement text in stub titles, and full REQ IDs in the response traceability array.
*Gap:* 5 of 9 stubs per file are noise from a shared acceptance-criteria parser bug: the spec's ToC link `[Acceptance Criteria Summary](#...)` and four `*Acceptance Criteria:**` label lines are emitted as tests, one traced to nonexistent "REQ-000". In-file test names truncate the `REQ-` prefix ("API-001 | ..."), breaking the name-based traceability that `sdd_verify_tests` relies on.

**P-14 — `sdd_verify_tests` ships a correct matrix and a contradictory 0% next to it**
*Evidence:* Given 4 named results, the traceability matrix was exactly right: 75% coverage, correct covered/uncovered lists, per-REQ status including "failing" — nothing fabricated.
*Gap:* The same payload carries an `enhanced_coverage` block reporting 0% with all 4 requirements "untested" (it only scans test files inside the `.specs` feature directory, never the directories `sdd_generate_tests` writes to), and `next_steps` is based on that wrong figure — "4 requirements lack test coverage. Write tests for: REQ-API-001..." — directly contradicting the correct matrix two fields above.

**P-15 — Hypothesis PBT generation compiles but is a scaffold, with fabricated trace IDs** (`sdd_generate_pbt`)
*Evidence:* The generated Python passes `py_compile` and uses real Hypothesis idioms (`@given`, `strategies as st`, `@settings(max_examples=100)`), one property per EARS requirement with pattern-appropriate shape.
*Gap:* Bodies call undefined `transition()`/`system_under_test()` and would error at runtime; strategies are generic `st.text()`/`st.integers()` unrelated to the domain; response traceability maps to fabricated `REQ-GEN-001..004` instead of the real REQ IDs.

**P-16 — `sdd_generate_devcontainer` detection ignores DESIGN.md despite the schema's claim**
*Evidence:* Output is valid JSON; with a real package.json/tsconfig.json present it correctly produced `typescript-node:22` with eslint/prettier extensions.
*Gap:* The schema promises detection "from DESIGN.md tech stack", but detection scans workspace code files only — with only DESIGN.md present (naming TypeScript/Express) it fell back to a generic ubuntu image with zero extensions and a hardcoded `npm install`. `features` is always `{}`.

**P-17 — `sdd_setup_local_env` never auto-detects services and misdescribes its fallback output**
*Evidence:* Returns the promised Docker MCP routing payload (compose_up, port, inline Dockerfile/compose/dockerignore) and detected TypeScript/Express correctly with package.json present.
*Gap:* `additional_services` is always `[]` — with DESIGN.md naming PostgreSQL and Redis *and* package.json depending on pg+redis, the compose payload contains only the app service. On an empty workspace the payload is a single-stage `ubuntu:22.04` container while the explanation falsely says "Generated multi-stage Dockerfile".

**P-18 — `sdd_setup_codespaces` routes to a GitHub MCP tool that does not exist**
*Evidence:* Returns the promised payload: machine type honored, devcontainer content inline, routing instructions, next steps.
*Gap:* The routing target `create_codespace` is not a tool the official GitHub MCP server exposes (verified against the live GitHub MCP toolset), so the instruction cannot be routed as written. Tech detection ignores DESIGN.md (codebase scan only); `features` always `{}`.

### Quality, compliance & intelligence

**P-19 — Compliance checking is genuinely differential but keyword-shallow, and its report file is a scaffold** (`sdd_compliance_check`)
*Evidence:* All 6 frameworks return distinct 6-control sets with real differential evaluation: a security-free spec failed HIPAA 3/6 and GDPR 4/6 with remediation strings; a keyword-rich spec passed 36/36.
*Gap:* Evaluation is naive substring matching — ISO 27001 passed 6/6 on a spec with zero security language because template words ("management", "operations", "roles") satisfy its keywords, and per-control evidence is just "Keywords matched" with no location pointer. The persisted COMPLIANCE.md renders its Controls Assessment table as the literal placeholder `[TODO: findings]`, and each framework run overwrites the single file, so after checking 6 frameworks only the last summary survives on disk.

**P-20 — `sdd_cross_analyze` findings are real; the persisted report is partially unrendered**
*Evidence:* Correct orphaned-requirement and missing-design findings; the consistency score moved 17 → 50 → APPROVE-level as traceability content was added; CROSS_ANALYSIS.md contains the real score, orphaned list, and a per-requirement Mermaid traceability flowchart.
*Gap:* Both alignment tables in the persisted file are the literal placeholders `[TODO: spec_design_alignment]` / `[TODO: design_tasks_alignment]`, and the Recommendation section is `[TODO: recommendation]`; the full detail exists only in the JSON response.

**P-21 — `sdd_checklist` statuses track artifact content, but the persisted file omits the checklist**
*Evidence:* Item statuses moved with content (mandatory pass rate 17% vs 50% across weak/strong workspaces; SEC-03/SEC-04 flipped exactly with the spec text); phase gating confirmed.
*Gap:* CHECKLIST.md's "Checklist Items" table renders as `[TODO: items]` (plus `[TODO: date]`, `[TODO: total_items]`, `[TODO: gate_decision]`) — only summary counts reach disk. Evaluation is a keyword-overlap heuristic (≥40% of long words), so statuses are indicative, not verified.

**P-22 — `sdd_verify_tasks` cannot parse the TASKS.md the pipeline itself writes**
*Evidence:* Against a checkbox-format TASKS.md, detection is genuinely correct: T-001 verified with code evidence, T-002 flagged phantom (claimed complete, 1/5 keywords in code), T-003 not started; 33% pass rate with a color-coded Mermaid diagram.
*Gap:* `sdd_write_tasks` writes TASKS.md as a markdown *table*, but `sdd_verify_tasks` only parses `- [x] T-001:` checkbox lines — run against the pipeline's own canonical artifact it errors with "No tasks found in TASKS.md". The auditor had to hand-rewrite TASKS.md to exercise it. VERIFICATION.md's results table is also the literal `[TODO: results]`.

**P-23 — Cognitive-debt gate metrics silently degrade in the standard hosted deployment**
*Evidence:* When server cwd == workspace, the signals are real and move with behavior: 4 unmodified approvals produced the arXiv-cited warning on every advance and `cognitive_debt_score: 60 / 'caution'`; a run with real edits read 0/'healthy'.
*Gap:* `recordGateEvent` stats the workspace-relative artifact path against the *process cwd* — when the server runs with cwd != SDD_WORKSPACE (the documented hosted/HTTP shape), the stat throws and the catch defaults `was_modified=true` for every gate, pinning the LGTM-without-modification rate at 0 and never firing warnings. Additionally, `sdd_get_status`'s `cognitive_debt_alert` (>70% threshold) reads per-feature state that never contains `gate_history`, so with a measured rate of 100% the alert still returned null — dead code in practice.

### CLI toolkit & installed assets

**P-24 — One of the 16 installed hooks crashes on nearly every real spec** (`ears-validator.sh`)
*Evidence:* 4 of 16 hooks were executed directly; branch-validator, security-scan, and session-banner behave exactly as advertised. ears-validator errored with `syntax error in expression` then `TOTAL: unbound variable`, exit 1, on a 3-requirement spec.
*Gap:* Root cause read from the installed file: `VAR=$(grep -cE '...' "$SPEC" 2>/dev/null || echo "0")` — when grep counts 0 matches it prints `0` *and* exits 1, so the `|| echo` appends a second `0`, producing a two-line value that breaks `$((...))` arithmetic under `set -euo pipefail`. The hook only completes when a spec contains at least one of *every* one of the 6 EARS patterns, so its advertised EARS coverage report is effectively never produced. (Advisory tier, so exit 1 does not block; the remaining 12 hooks were installed and wired but not individually executed.)

### Input formats & MCP-to-MCP integration

**P-25 — `sdd_auto_pipeline` produces a real spec package but fabricates its ANALYSIS gate**
*Evidence:* One call on a transcript wrote 13 files (29,927 B) with 13 REQ ids genuinely traceable to the transcript content (5-minute email notifications, PostgreSQL, GDPR retention).
*Gap:* ANALYSIS.md contains "Decision: APPROVE / Coverage: 100%" with a "traceability matrix" that only lists 4 files as "Present" — `dist/tools/transcript.js` hard-codes `coveragePercent=100` / `gateDecision="APPROVE"`, unlike `sdd_run_analysis` and `sdd_batch_transcripts` which use the real AnalysisEngine (proven honest elsewhere with CHANGES_NEEDED at 75%). EARS output includes unfilled template splices ("If <unwanted condition>, then the system shall Thanks Paula...") and `[TODO: date]`. `sdd_get_status` immediately afterward reports init/0% (see P-03).

**P-26 — PDF import only works for uncompressed text streams** (`sdd_import_document`)
*Evidence:* An uncompressed-stream PDF extracted its sentences correctly (word_count 21) with an honest note recommending pdfjs-dist or MarkItDown MCP.
*Gap:* A FlateDecode-compressed PDF — the encoding virtually every real-world PDF uses — returned word_count 0 and an empty markdown body, reported as *success* (and counted "successful" by `sdd_batch_import`). pdfjs-dist is an optional dependency that is not installed, so real PDFs from Word/Chrome/LaTeX yield empty text silently.

**P-27 — PPTX import returns garbage for files PowerPoint actually writes**
*Evidence:* A ZIP_STORED (uncompressed) .pptx extracted real per-slide text (2 slides, word_count 27), with zip-path noise prefixed.
*Gap:* A ZIP_DEFLATED variant — what PowerPoint actually produces — returned compressed binary garbage as slide text with status success and page_count 2. Only unrealistic uncompressed archives yield usable text.

**P-28 — `sdd_figma_to_spec` is a routing echo, and it names tools that do not exist**
*Evidence:* Returns exactly the documented routing payload — feature dir, 4-step instructions telling the client to call Figma MCP's `get_design_context` and feed results into `sdd_discover` — with no fabricated design content and no network call, matching the tool description.
*Gap:* As an advertised "input type" it is far thinner than transcript/docs: Specky performs zero extraction itself. The payload's step 4 references nonexistent tool names (`sdd_gen_spec`, `sdd_gen_design`, `sdd_gen_tasks`) instead of the real `sdd_write_spec`/`sdd_write_design`/`sdd_write_tasks`, which would misroute a literal-minded client.

**P-29 — Work-item exports are not platform-specific and silently discard documented options** (`sdd_export_work_items`)
*Evidence:* All three platforms returned 7 items parsed from the real TASKS.md with full REQ/task traceability and correct per-platform routing instructions plus honest install guidance; phase gating verified.
*Gap:* The items arrays for GitHub/Azure Boards/Jira are byte-identical generic objects. The documented Jira `project_key` ("required for Jira"), Azure `area_path`/`iteration_path`, and `include_subtasks` are accepted and silently discarded — `src/services/work-item-exporter.ts` `export()` takes them as unused `_options`, while the real platform-shaped builders (`toGitHubPayloads`, `toAzureBoardsPayloads`, `toJiraPayloads`) exist but are never called on this path. Titles also duplicate the `traces_to:` suffix.

---

## 5. Not-delivered findings (6)

**N-01 — pytest generation emits a Python syntax error** (`sdd_generate_tests framework=pytest`)
*Evidence:* The tool returned `tests_generated` and wrote a file with `import pytest`, a test class, and `def test_...` methods traced to requirement text — but the file header is a JavaScript block comment (`/** ... */`). `python3 -m py_compile` fails ("SyntaxError: leading zeros in decimal integer literals are not permitted", line 5); pytest cannot even collect the file.
*Gap:* The generated Python is a syntax error out of the box (the Hypothesis PBT generator gets the docstring header right, so this is a pytest-generator bug). It also inherits the markdown-noise stubs and REQ-prefix truncation of P-13.

**N-02 — JUnit generation can never compile** (`sdd_generate_tests framework=junit`)
*Evidence:* Real `javac` run reported: "class todoapiauditTest is public, should be declared in a file named todoapiauditTest.java" — the generator writes a hyphenated filename (`todo-api-auditTest.java`) that can never match a Java public class name — plus 3× "method acceptanceCriteria() is already defined" (the markdown-noise stubs slugify to the same identifier).
*Gap:* Hard compile errors regardless of classpath; the @Test idiom is present but the artifact is unusable without manual repair.

**N-03 — xUnit generation produces guaranteed duplicate-member compile errors** (`sdd_generate_tests framework=xunit`)
*Evidence:* The generated C# contains four identical `public void AcceptanceCriteria()` methods (same noise-slug collision as N-02) — a guaranteed CS0111 duplicate-member error (verified by inspection; the .NET SDK was unavailable in the sandbox).
*Gap:* Uncompilable C# out of the box from the acceptance-criteria parsing bug; idioms (`using Xunit;`, `[Fact]`, `Assert.True`) are otherwise correct.

**N-04 — fast-check PBT output cannot even be imported** (`sdd_generate_pbt framework=fast-check`)
*Evidence:* The file uses `import { fc } from "fast-check"` — the auditor installed the real fast-check package and verified there is **no named `fc` export**, so the module throws on load. Every property body calls undefined placeholder functions (`transition()`, `systemUnderTest()`) and returns true — vacuous; the response traceability maps properties to fabricated `REQ-GEN-001..004` instead of the actual REQ IDs.
*Gap:* Not property tests: the file fails at import time, asserts nothing, and its requirement traceability is fabricated. Only the EARS-pattern classification and quoted requirement text are genuine.

**N-05 — Terraform generation contains zero resource blocks** (`sdd_generate_iac`)
*Evidence:* Called for both azure and aws after DESIGN.md described Azure Container Apps + PostgreSQL Flexible Server + Redis. Both runs wrote main.tf/variables.tf/outputs.tf/tfvars — but main.tf contains only the `required_providers` and provider blocks followed by `# TODO: Add compute resources` (×4 for the same generic compute/database/storage/monitoring "modules" regardless of the design); outputs are empty strings with TODOs. The response nonetheless claims "Generated Terraform for azure with 4 modules" and ships a Mermaid diagram of the 4 boxes.
*Gap:* No infrastructure resources at all — a provider-only skeleton whose explanation and diagram oversell an empty scaffold; the Redis cache and Container Apps from the design never appear.

**N-06 — DOCX import never extracts the document's text** (`sdd_import_document`)
*Evidence:* Two real .docx zips were built containing `word/document.xml` with known sentences. Best case (uncompressed ZIP): the tool returned only a `[Content_Types].xml` fragment (word_count 2) — the naive `indexOf` finds the path string inside `[Content_Types].xml` before the actual document part. Realistic case (deflated, what Word writes): binary garbage returned as markdown with status *success*. The mammoth optional dependency is not installed.
*Gap:* DOCX extraction produced the document body in no tested configuration, and compressed (i.e., all real) files return gibberish presented as a successful conversion — worse than an error, because `sdd_batch_import` counts them successful. The advertised DOCX input currently works only via the recommended external MarkItDown MCP.

---

## 6. Remediation

The findings above are being fixed for the next release. The audit's recurring patterns define the remediation themes:

1. **Persisted reports must render their own data.** COMPLIANCE.md, CHECKLIST.md, VERIFICATION.md, CROSS_ANALYSIS.md, and ANALYSIS.md ship `[TODO: ...]` placeholders exactly where their findings tables belong, while the real data exists only in the MCP JSON response (P-19, P-20, P-21, P-22).
2. **Generated code must pass its own language's parser.** Three of six test frameworks and one of two PBT frameworks emit files that fail `py_compile`, `javac`, or module import (N-01..N-04); the shared acceptance-criteria parser bug (P-13) is a single root cause behind several of them.
3. **"Success" must mean success.** Compressed PDF/DOCX/PPTX inputs return empty or garbage text with a success status (P-26, P-27, N-06), and `sdd_auto_pipeline` hard-codes its gate (P-25); silent degradation must become explicit errors or honest partial statuses.
4. **State must be read where it is written.** `sdd_get_status` and the cognitive-debt alert read a per-feature state file no pipeline tool writes (P-03, P-23); the phase-skipping loophole (P-01) and the cwd-sensitive `was_modified` stat (P-23) are the same class of environment-coupling bug.
5. **Generators must consume the design they claim to consume.** Runbook, IaC, devcontainer/local-env/codespaces detection, work-item options, and several diagram types read DESIGN.md and discard it — or never read it (P-11, P-16, P-17, P-18, P-29, N-05, P-04).

Additional observations recorded during the audit, tracked with the same remediation effort even where the parent promise was delivered: a pipeline dead-end where a CHANGES_NEEDED gate in analyze phase-blocks the very tools needed to remediate (`sdd_write_design`/`sdd_write_tasks`); checkpoints not covering the companion spec-package files; the canned `context_load_summary` (`savings_percent: 90` from fixed 1000-vs-10000 token estimates) and hardcoded `model_routing_hint` appended to every tool response; the PR body counting gate checkboxes as tasks; template-splice grammar defects in turnkey/auto-pipeline EARS output; and transcript extraction classifying greetings and open questions as requirements.

This report reflects execution of `specky-sdd@3.5.0` as built from this repository on 2026-07-03. It will not be retroactively edited; delivery of the fixes will be verified by re-running the same audit against the next release.
