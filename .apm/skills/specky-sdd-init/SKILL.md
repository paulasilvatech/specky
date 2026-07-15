---
name: specky-sdd-init
description: "Use when initializing Phase 0 (Init): scaffold .specs/NNN-feature/, CONSTITUTION.md, .sdd-state.json, and spec branch from develop. Trigger on sdd_init, greenfield setup, or new feature bootstrap."
---

# Phase 0 — Explicit Feature Initialization

## Required Decisions

Do not combine lifecycle and workload into one “project type.” Collect both:

- `lifecycle`: `greenfield`, `brownfield`, or `migration`
- `workload`: `api`, `web-application`, `service`, `cli`, `library`, or `infrastructure`
- `execution_mode`: `full`, `rapid`, or `emergency`
- explicit `feature_number`: three digits; no allocator or first-feature fallback exists
- `capabilities` and a matching `capability_config` entry for every enabled capability

`capabilities` and `capability_config` keys must match exactly. Empty capabilities require `capability_config: {}`.

## Capability Parameters

| Capability | Required configuration |
|---|---|
| `compliance` | frameworks, control pack `2026.1`, `evidence_required: true` |
| `tdd` | test/property frameworks, output directory, threshold, trace marker, imports, executable test and property bindings |
| `iac` | Terraform, cloud, concrete `{module, service}` resources, state backend, region policy |
| `dev-environment` | language/runtime/package manager, port, services, machine, extensions, image, features, compose and multi-stage decisions |
| `document-import` / `transcript-import` | explicitly allowed formats and transcript attribution policy |
| `figma` | extraction scope, component-property policy, permitted FigJam diagram types |
| `work-items` | platform and platform-specific fields; Jira requires `project_key` |
| `release` | branch prefix, base branch, draft PR, checkpoint policy |

## Exact `sdd_init` Input

```json
{
	"project_name": "order-api",
	"spec_dir": ".specs",
	"feature_number": "001",
	"use_case": {
		"lifecycle": "greenfield",
		"workload": "api",
		"execution_mode": "full",
		"capabilities": [],
		"capability_config": {}
	},
	"principles": ["Every public operation is versioned"],
	"constraints": ["No local credentials"]
}
```

## Lifecycle Preconditions

- Brownfield: run `sdd_scan_codebase` with explicit `depth` and `exclude` values; preserve its output for `sdd_discover.codebase_summary`.
- Migration: identify source and target summaries before Discover.
- Greenfield: distinguish fixed constraints from open choices.

## Outputs and State

`sdd_init` writes CONSTITUTION.md plus signed state at `.specs/<NNN-name>/.sdd-state.json`. Root `.specs/.sdd-state.json` is legacy and requires `specky migrate-contracts`.

## Rules

- Do not create a branch during Init. `sdd_create_branch` is enabled only in Analyze/Implement and only with `release` capability.
- Do not infer omitted values or use `001`/`.specs` implicitly.
- Do not proceed when config, contract, capability parameters, or feature identity are incomplete.