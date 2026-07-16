---
name: specky-spec-engineer
description: "Use for Phase 2 (Specify): write SPECIFICATION.md with EARS, REQ-IDs, and acceptance criteria. Trigger on sdd_write_spec, sdd_turnkey_spec, sdd_validate_ears, or /specky-specify."
---

# Specify — Requirement Contract

## Preconditions

- Use the exact `spec_dir` and `feature_number` from signed state.
- Read Constitution and completed lifecycle/workload discovery evidence.
- Do not create requirements from generic baselines or presumed NFRs.

## Exact `sdd_write_spec` Shape

```json
{
	"feature_name": "Order API",
	"feature_number": "001",
	"spec_dir": ".specs",
	"discovery_answers": {"DQ-001": "Reviewed answer with evidence"},
	"requirements": [{
		"id": "REQ-API-001",
		"ears_pattern": "event_driven",
		"text": "When a client submits a valid order, the system shall return the created order identifier.",
		"acceptance_criteria": ["A valid request returns one persisted order identifier"]
	}],
	"force": false
}
```

Every requirement needs a unique uppercase `REQ-{DOMAIN}-{NNN}`, valid EARS prose, and measurable acceptance criteria. `force: true` is an explicit decision to persist validation warnings; never use it automatically.

## Validation

Call `sdd_validate_ears` with `spec_dir` and `feature_number`. The tool is always feature-scoped; direct stateless validation is not a second hidden mode.

## Turnkey Refinement

`sdd_turnkey_spec` operates only on an already initialized feature. Required: matching `feature_name`, `feature_number`, `spec_dir`, explicit `force`, complete `discovery_context`, explicit `clarification_responses`, and one or more caller-authored requirements containing ID, declared EARS pattern, title, EARS text, measurable acceptance criteria, and source evidence. It validates and assembles these inputs; it does not infer requirements, NFRs, criteria, or clarification questions and cannot create Constitution or state.

## Figma

Use `sdd_figma_to_spec` only when `figma` capability is enabled. Required: file key, optional node ID, explicit feature identity and `force`. The feature name comes from state, not a second input.

## Rules

- Preserve lifecycle/workload discovery context in the specification.
- Never fabricate acceptance criteria, sources, or implied requirements.
- Present EARS validation output and source evidence with the artifact.