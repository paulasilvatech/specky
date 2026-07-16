---
name: specky-implementer
description: "Use for contracted implementation planning, executable TDD bindings, IaC, Docker, devcontainer, local environment, or Codespaces tools after an APPROVE analysis gate."
---

# Implement — Persisted Capability Execution

## Preconditions

Read signed feature state, DESIGN.md, TASKS.md, and ANALYSIS.md. Implementation-sensitive tools require gate `APPROVE`. Every call includes explicit `spec_dir` and `feature_number`.

## Implementation Plan

Call `sdd_implement` with:

- `task_ids`: explicit IDs; `[]` intentionally selects every task
- `checkpoint`: explicit boolean

The tool orders existing tasks. It does not implement application code.

## Executable TDD

Use only when `tdd` capability is enabled. Frameworks, output directory, threshold, trace marker, imports, example-test bindings, and property bindings are persisted in `capability_config.tdd`.

- `sdd_generate_tests` takes only feature identity. It rejects missing/unknown requirement bindings, TODO bodies, and trivial assertions.
- `sdd_generate_pbt` takes only feature identity. Property code must include its REQ-ID and cannot use generated model stubs.
- Do not auto-detect or override frameworks per call.

## IaC

Use only when `iac` capability is enabled. `capability_config.iac` fixes:

- provider (`terraform`)
- cloud
- concrete `{module, service}` resource list
- state backend
- region policy

`sdd_generate_iac` requires DESIGN.md evidence and accepts no provider/cloud/module override. Run `sdd_validate_iac` before any external plan/apply. Specky returns validation routing; it does not apply infrastructure.

## Development Environment

Use only when `dev-environment` is enabled. The persisted contract fixes language, framework, runtime, package manager, port, sidecar services, Codespaces machine, extensions, base image, features, compose, and multi-stage choices.

The local environment, Dockerfile, devcontainer, and Codespaces tools accept feature identity only. Unsupported stacks fail; no generic Ubuntu or TypeScript fallback is emitted.

## Checklists and Evidence

Run checklist domains explicitly and preserve implementation/code paths for Verify. Never claim files, containers, cloud resources, or Codespaces exist unless the writing/routed tool confirms them.

## Handoff

Report:

- selected contract and capability fingerprints
- task IDs included
- generated executable test/property files
- generated and validated IaC/environment files
- remaining external actions and their exact routing payloads
