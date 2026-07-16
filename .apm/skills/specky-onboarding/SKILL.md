---
name: specky-onboarding
description: "Use when starting or resuming Specky work, selecting lifecycle/workload/mode/capabilities, diagnosing config/state, or choosing an agent/tool."
---

# Specky Onboarding — Explicit Contract Wizard

## 1. Validate Workspace

1. Validate `.specky/config.yml`; an existing invalid/partial file blocks execution.
2. Enumerate `.specs/NNN-name/` directories.
3. Report signed v5 state per feature. Root `.specs/.sdd-state.json`, unsigned state, or older versions require `specky migrate-contracts --dry-run` before tools run.
4. Never select the latest or first feature automatically.

## 2. Select the Use Case

Collect independently:

- lifecycle: greenfield, brownfield, migration
- workload: API, web application, service, CLI, library, infrastructure
- execution mode: full, rapid, emergency
- explicit three-digit feature number

The selected mode produces a persisted phase graph. Do not describe rapid/emergency as “skipping” a mandatory full graph; their contracted graphs are different by design.

## 3. Select Capabilities

Capabilities are opt-in and require matching parameter objects. Review the exact table in the `specky-sdd-init` skill. Ask for every provider, framework, resource, branch, threshold, format, platform, and environment value. `capabilities: []` requires `capability_config: {}`.

## 4. Gather Lifecycle Evidence

- Greenfield: outcome, boundaries, stakeholders, fixed/open constraints.
- Brownfield: run `sdd_scan_codebase` with explicit depth/exclusions; preserve baseline, compatibility, insertion, and rollback evidence.
- Migration: preserve named source inventory, target inventory, parity/divergence, wave, cutover, rollback, and decommission evidence.

## 5. Choose Input Source

- Documents: enable `document-import`; explicitly allow formats.
- Transcripts: enable `transcript-import`; import may parse source, but auto/batch orchestration also requires explicit Constitution, source-backed requirements, complete architecture, tasks, and gates. Source quotes are validated before writes.
- Figma: enable `figma` and select extraction scope/diagram types.
- Direct discovery: questions are lifecycle/workload-specific.

## 6. Choose Execution Surface

- Orchestrator: follows signed phase graph and delegates to lean agents.
- Agent: first reads its rich companion skill.
- Direct MCP: caller supplies every required field; no Zod defaults exist.

## 7. Branching

Do not create a branch in Init. When `release` capability is enabled and phase policy permits, use persisted branch prefix/base/draft/checkpoint parameters.

## Completion

Before routing, repeat the full selection and obtain confirmation. Then initialize or resume the exact feature and report the contract ID, fingerprint, canonical state path, and next contracted phase.
