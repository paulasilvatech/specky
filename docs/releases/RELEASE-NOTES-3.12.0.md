# Specky 3.12.0 - Evidence-Grounded Diagrams and Terraform

> Copy-paste body for the GitHub Release `v3.12.0`.

Specky 3.12.0 adds deterministic, evidence-grounded diagram generation and strengthens Terraform generation from `DESIGN.md`. The release preserves explicit diagram payloads as the default while adding an automatic mode for supported Mermaid types. Unsupported infrastructure now fails before any Terraform files are written.

## Highlights

### Explicit or Automatic Diagrams

`sdd_generate_diagram` and `sdd_generate_all_diagrams` accept `mode: "explicit" | "auto"`. Explicit mode remains the default and validates caller-supplied Mermaid plus source evidence. Auto mode derives C4 context, sequence, ER, and deployment diagrams from `SPECIFICATION.md` and `DESIGN.md`, including evidence references for the actors, requirements, exchanges, entities, components, and deployment nodes used in each result.

### Atomic Diagram Sets

Automatic diagram-set generation synthesizes and validates every contracted diagram in memory before writing `DIAGRAMS.md`. If the contract includes an unsupported type or any generated diagram fails validation, the prior artifact is left unchanged.

### DESIGN.md-Driven Terraform

Terraform resource discovery uses canonical `module:service` keys and only the relevant design sections. Clause-scoped negation recognizes exclusions such as `without`, `avoid`, and `not use`, preventing excluded services from becoming resources.

### Fail-Fast Infrastructure Preflight

Every requested resource must have a concrete template for the selected cloud. Unsupported resource types now produce an actionable hard error instead of placeholder comments or incomplete Terraform.

### Cross-Platform and Developer Quality

Feature directories use stable forward-slash identifiers in user-facing MCP messages on Windows. The `specky compile` command validates and reads each instruction primitive through one file descriptor, eliminating a CodeQL-reported filesystem race. The release Docker build includes the Cursor plugin metadata consumed by manifest validation and an ephemeral internal workspace contract for no-volume health checks; mounted workspaces still require the strict `.specky/config.yml` created by `specky install`. The release also adds Biome lint/format commands, broader unit coverage, and longer integration-test timeouts for subprocess-heavy suites under CPU contention.

## Compatibility

Existing diagram calls remain compatible because `mode` defaults to `explicit`. Callers using explicit mode continue to provide `mermaid_code` and `evidence_refs`; callers using auto mode omit those fields and let Specky derive both from the feature artifacts.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
specky doctor
```

Project-scoped MCP registrations are pinned, so run `specky upgrade` after updating the npm package to refresh agents, prompts, skills, hooks, and the MCP runtime reference.

## Validation

The release candidate passes the TypeScript build, manifest and primitive audits, 1019 tests across 99 files, and coverage thresholds of 89% statements, 77% branches, 95% functions, and 90% lines. The publish workflow also performs clean-package installation checks and builds the multi-architecture GHCR image with a CycloneDX SBOM artifact.

## References

- [Specky documentation](https://github.com/paulasilvatech/specky/tree/main/docs)
- [MCP API reference](https://github.com/paulasilvatech/specky/blob/main/docs/API_REFERENCE.md)
- [Use-case contracts](https://github.com/paulasilvatech/specky/blob/main/docs/USE-CASE-CONTRACTS.md)
- [Publishing Specky](https://github.com/paulasilvatech/specky/blob/main/docs/PUBLISH.md)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)
