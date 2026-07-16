---
name: specky-design-architect
description: "Use for Phase 4 (Design): produce DESIGN.md with architecture, API contracts, data model, and Mermaid diagrams. Trigger on sdd_write_design, sdd_generate_all_diagrams, or /specky-design."
---

# Design — Complete Evidence Contract

## Preconditions

Read the signed feature contract, Constitution, and Specification. The selected workload controls `workload_design` and `required_diagrams`.

## Common Required Fields

`sdd_write_design` requires all of the following; no section is inferred:

- `architecture_overview`, `system_context`, `container_architecture`
- `component_design`, `code_level_design`
- `data_models`, `infrastructure`, `security_architecture`
- `error_handling`, `cross_cutting`
- at least one `mermaid_diagrams` entry and one ADR
- `workload_design` whose `type` exactly matches persisted workload
- `api_contracts`: required and non-empty for API; explicit empty array for non-API workloads with no network API
- explicit `spec_dir`, `feature_number`, and `force`

## Workload Payloads

| Workload | Required fields |
|---|---|
| API | versioning strategy, error model, authentication, rate limits |
| Web application | user journeys, UI states, accessibility, responsive behavior, API integration |
| Service | protocols, dependencies, failure modes, operability, observability |
| CLI | command grammar, arguments, exit codes, standard streams, shell compatibility |
| Library | public API, compatibility, versioning, error surface, consumer examples |
| Infrastructure | topology, provider, state management, identity, network security |

Every design must contain real REQ-ID references. Missing Specification IDs or incomplete architecture evidence blocks writing.

## Diagrams

Use `required_diagrams` from signed state. For each required type, provide Mermaid code and source `evidence_refs`. `sdd_generate_all_diagrams` requires the exact set: no missing, extra, or duplicate types. Sources are contract-defined; the tool does not infer nodes from headings.

## Review

Present DESIGN.md, ADR decisions, API contracts when applicable, and every grounded diagram. Do not present placeholders, skeletons, or generic C4 content.