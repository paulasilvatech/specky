---
name: specky-sdd-pipeline
description: "Use for Specky contract architecture, lifecycle/workload/mode selection, feature state, phase transitions, tool scope, evidence, and gates."
---

# Specky SDD Contract Model

## Feature Identity and State

Every feature is explicit: `spec_dir` plus a three-digit `feature_number`. Canonical state is signed and stored at `.specs/NNN-name/.sdd-state.json`. There is no root state, first feature, latest feature, `001`, or `.specs` fallback in MCP schemas.

State embeds a versioned use-case snapshot and SHA-256 fingerprint. Tools reject identity mismatch, disabled capabilities, config-disabled contracts, invalid signatures, and legacy state.

## Use-Case Dimensions

- Lifecycle: greenfield, brownfield, migration
- Workload: API, web application, service, CLI, library, infrastructure
- Execution mode: full, rapid, emergency
- Capabilities: compliance, TDD, IaC, dev environment, document/transcript import, Figma, work items, release

All 54 lifecycle/workload/mode combinations are named contracts. Capabilities and parameter objects are additional explicit dimensions.

## Phase Graphs

The signed `contract.phases` array controls transitions. Full includes Init, Discover, Specify, Clarify, Design, Tasks, Analyze, Implement, Verify, Release. Rapid and emergency persist smaller graphs. Never impose a global phase list; route only phases present in state.

## Tool Scopes

Every MCP tool has one declared scope: stateless, workspace, bootstrap, batch, or feature. Feature tools require canonical state. Bootstrap/batch/workspace capability tools require an explicit use-case selection. Unknown tools have no compatibility fallback and fail registration/lookup.

## Artifact Evidence

- Templates fail on missing scalar/loop variables; no `[TODO:]` substitution exists.
- Design requires complete common and workload-specific fields.
- Diagrams require the exact workload manifest, explicit Mermaid/FigJam structures, and source evidence references.
- User stories are web-application-only and explicitly bound to every requirement.
- Example and property tests require executable persisted bindings for every requirement; trivial assertions and model stubs are rejected.
- Transcript orchestration validates source quotes and complete feature content before writing.
- Compliance uses versioned control IDs plus explicit evidence, never keyword matching.

## Gates

Analyze computes `APPROVE`, `CHANGES_NEEDED`, or `BLOCK`. Implementation-sensitive tools centrally require APPROVE. Rewriting Specification, Design, or Tasks invalidates prior approval. LGTM blocking is controlled by strict workspace config.

## Capabilities

Capability configuration is fingerprinted with state and cannot be overridden per call. Examples:

- IaC fixes cloud and concrete Terraform resources.
- Dev environment fixes stack, services, ports, images, extensions, and machine.
- TDD fixes frameworks, output, threshold, imports, and executable bindings.
- Release fixes branch prefix/base/draft/checkpoint policy.
- Work items fix platform and target fields.

## Migration

Use `specky migrate-contracts --spec-dir=<path> --dry-run` with explicit use-case mapping. Review the deterministic plan hash, then apply the identical plan with `--confirm-plan`. Migration backs up metadata, signs v5 state, verifies non-state artifact hashes, and rolls back on failure.

## Agent Pattern

Agents are lean workflow routers. Their first action is to read the companion skill, which owns exact schemas, rules, examples, and evidence standards.
