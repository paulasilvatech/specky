# Use-Case Contracts

Specky executes one explicit, signed contract per feature. A contract combines lifecycle, workload, execution mode, and optional capabilities. It is resolved once, fingerprinted, and persisted in the feature state; tools cannot silently substitute another feature, provider, framework, platform, branch, or mode.

## Contract Dimensions

### Lifecycle

| Lifecycle | Required discovery evidence |
|---|---|
| `greenfield` | Outcome, first-release boundaries, stakeholders, exclusions, fixed constraints, and open decisions |
| `brownfield` | Codebase baseline, affected modules/owners/dependencies, compatibility matrix, insertion point, coexistence, and rollback boundary |
| `migration` | Source inventory, target inventory, parity/divergence matrix, data conversion, validation, waves, cutover, rollback, and decommission plan |

Brownfield discovery requires `codebase_summary`. Migration discovery requires `migration_source` and `migration_target`. Missing lifecycle evidence blocks the tool.

### Workload

| Workload | Required design contract | Required diagram manifest |
|---|---|---|
| `api` | Versioning, error model, authentication/authorization, quotas/rate limits, at least one API contract | C4 context, request sequence, ER model |
| `web-application` | User journeys, UI states, accessibility, responsive behavior, API integration | Activity journey, UI state, container architecture |
| `service` | Protocols/callers, dependencies, failure modes, operability, observability | Service context, interaction sequence, deployment |
| `cli` | Command grammar, arguments/options, exit codes, streams, shell/OS compatibility | Command flow, process states, code structure |
| `library` | Public API, consumer compatibility, versioning/deprecation, error surface, consumer examples | Class/public API, code structure, consumer sequence |
| `infrastructure` | Topology, provider/regions, state management/drift, identity/RBAC, network security | Deployment, network topology, resource topology |

Every design also requires common C4/context/container/component/code sections, data models, infrastructure, security, error handling, cross-cutting concerns, at least one ADR, at least one Mermaid diagram, and real requirement references.

### Execution Mode

| Mode | Persisted phase graph |
|---|---|
| `full` | Init, Discover, Specify, Clarify, Design, Tasks, Analyze, Implement, Verify, Release |
| `rapid` | Init, Discover, Specify, Design, Tasks, Analyze, Implement, Verify, Release |
| `emergency` | Init, Specify, Tasks, Analyze, Implement, Verify, Release |

These are distinct contract graphs. The state machine advances only to the next phase in the persisted graph; it does not start with a universal graph and then infer which phases to skip.

There are 54 named lifecycle/workload/mode contracts: $3 \times 6 \times 3$.

## Capabilities

Capabilities are opt-in. `capabilities` and `capability_config` must have exactly the same keys.

| Capability | Persisted parameters |
|---|---|
| `compliance` | Framework list, control-pack version `2026.1`, mandatory evidence policy |
| `tdd` | Example/property frameworks, output directory, coverage threshold, trace marker, imports, executable test bindings, executable property bindings |
| `iac` | Terraform provider, cloud, concrete `{module, service}` resources, state backend, region policy |
| `dev-environment` | Language/framework/runtime/package manager, port, services, Codespaces machine, extensions, image, features, compose and multi-stage choices |
| `document-import` | Allowed document formats |
| `transcript-import` | Allowed transcript formats and speaker-attribution policy |
| `figma` | Extraction scope, component-property requirement, permitted FigJam diagram types |
| `work-items` | Platform, subtask policy, Jira project or Azure Boards paths |
| `release` | Branch prefix, base branch, draft PR, checkpoint policy, enabled documentation types/version, API base URL where applicable, deployment, health, monitoring, troubleshooting, rollback, support, and onboarding procedures |

Capability parameters are part of the feature fingerprint. A later tool call cannot override them.

## Exact Feature Identity

Feature tools require:

```json
{
  "spec_dir": ".specs",
  "feature_number": "001"
}
```

There are no schema defaults for either field. Workspace status is a separate explicit mode:

```json
{"view":"workspace","spec_dir":".specs"}
```

Feature status requires `view: "feature"` plus `feature_number`. Specky never selects the newest, first, or only feature automatically.

## Canonical State

Each feature owns:

```text
.specs/001-order-api/.sdd-state.json
.specs/001-order-api/.sdd-state.json.sig
```

State version `5.0.0` contains immutable feature identity, resolved contract, fingerprint, phase graph, phase status, gates, and evidence history. Reads fail closed when state is missing, unsigned, tampered, legacy, loaded from another directory, or inconsistent with the contract.

A root `.specs/.sdd-state.json` is legacy metadata, not runtime state.

## Strict Workspace Configuration

Runtime requires a complete `.specky/config.yml`. Missing, partial, malformed, unknown-key, or path-escaping documents block startup. `specky install` is the only bootstrap path that creates the complete file.

Configuration fixes:

- the specs root;
- explicit numbering strategy;
- enabled named contracts;
- security, audit, RBAC, and rate limits;
- installation target policy;
- LGTM enforcement.

Enterprise profile changes security controls only. It does not change lifecycle, workload, phase graph, artifacts, capabilities, or tool behavior.

## Evidence Rules

### Templates and Metadata

Template rendering requires every scalar and loop value. Missing values raise `TemplateRenderError`; Specky does not emit `[TODO: field]`. Every generated artifact declares version, date, author, status, title, and feature ID explicitly.

### Requirements and Tasks

Requirements use unique `REQ-{DOMAIN}-{NNN}` IDs, valid EARS prose, and measurable acceptance criteria. Tasks use `T-NNN`, explicit dependencies/parallel decisions, S/M/L effort, and one or more real requirement traces.

### Diagrams

The feature contract defines the exact required diagram types, source artifact, and title. MCP diagram calls supply Mermaid code plus `evidence_refs` present in that source. “Generate all” requires the exact set with no missing, extra, or duplicate types. FigJam payloads supply explicit nodes/connections and source evidence.

### User Stories

User-story generation is available only to `web-application` workloads. Every Specification requirement must have an explicit role, goal, benefit, priority, acceptance criteria, independent test, and flow steps.

### Tests and Properties

TDD bindings cover every Specification requirement. Example test bodies and property bodies are executable contract data. Specky rejects unknown/missing IDs, TODO markers, trivial assertions, and generated system-under-test models.

### Transcripts

Transcript import may parse source material. Auto/batch orchestration additionally requires explicit Constitution, source-quoted requirements, complete architecture, tasks, and gates. Every quote is checked against transcript text before the first write. Batch manifests must match transcript filenames one-to-one and declare unique feature numbers.

### Compliance

Compliance evaluates every configured control pack using evidence keyed by control ID. Keyword presence in prose is not evidence. Missing evidence fails a control; no generic compliance framework fallback exists.

### Research and Turnkey Assembly

`sdd_research` writes only resolved or explicitly deferred entries with context, evidence-based findings, at least one reviewed source, recommendation, status, and explicit overwrite intent. `sdd_turnkey_spec` assembles caller-authored EARS requirements and rejects missing evidence, criteria, duplicate IDs, invalid EARS text, or a declared pattern that differs from validator output. Neither tool creates placeholder findings or inferred requirements.

### Documentation

Documentation is enabled and parameterized by `capability_config.release.documentation`. Individual tools reject disabled types. Full docs require Specification, Design, Tasks, and Analysis; API docs require API workload, a persisted base URL, and complete request/response blocks; runbooks and onboarding use persisted procedures and contacts. `sdd_generate_all_docs` prevalidates every enabled type and writes the complete set atomically, so generation or file conflicts leave prior docs unchanged.

### IaC and Development Environments

IaC uses exact persisted cloud resources; DESIGN.md is required evidence. Development tools use the persisted stack, services, image, port, extensions, and machine. Unsupported stacks fail instead of producing generic Ubuntu, TypeScript, or provider skeletons. Validation returns routing payloads; it does not apply infrastructure.

## Contract-Aware Hooks

Feature-scoped hooks resolve `SDD_SPEC_DIR` and `SDD_FEATURE_NUMBER` from tool input or environment, verify the signed v5 state and contract fingerprint, and export workload/capability policy. They do not scan for the most recently modified feature.

Session/prompt hooks without explicit identity remain workspace-level and do not attach themselves to a feature. Branch checks use `capability_config.release`; release gates use the persisted TDD threshold and analysis decision.

## Safe Migration

Start with a deterministic dry run:

```bash
specky migrate-contracts \
  --spec-dir=.specs \
  --dry-run \
  --lifecycle=greenfield \
  --workload=api \
  --execution-mode=full \
  --capabilities=
```

For multiple features, use a JSON mapping with one complete use-case selection per feature number. Enabled capabilities require a separate complete capability-config JSON.

The dry run emits a plan hash. Apply only the reviewed plan with identical inputs:

```bash
specky migrate-contracts \
  --spec-dir=.specs \
  --apply \
  --confirm-plan=<sha256> \
  --mapping=contracts.json
```

Migration:

1. inventories features and source metadata;
2. rejects ambiguous root state and unsupported current phases;
3. hashes every non-state artifact;
4. backs up state metadata under `.specky/migrations/<plan-hash>/`;
5. writes and verifies signed v5 state per feature;
6. verifies non-state artifact hashes did not change;
7. removes legacy root metadata only after success;
8. restores original metadata and removes the failed backup transaction on error.

Run `specky doctor` and `specky status` after apply. Do not delete backups until the migrated workspace passes its validation and workflow smoke tests.

## References

- [Easy Approach to Requirements Syntax (EARS), IEEE Requirements Engineering 2009](https://doi.org/10.1109/RE.2009.9)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/)
- [Zod documentation](https://zod.dev/)
- [Node.js Crypto documentation](https://nodejs.org/api/crypto.html)
- [Mermaid syntax reference](https://mermaid.js.org/intro/syntax-reference.html)
- [Terraform validate command](https://developer.hashicorp.com/terraform/cli/commands/validate)
