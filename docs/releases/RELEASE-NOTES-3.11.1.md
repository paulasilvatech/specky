# Specky 3.11.1 - Signed Per-Feature Contracts

> Copy-paste body for the GitHub Release `v3.11.1`.

Specky 3.11.1 makes the use-case contract a signed, per-feature runtime boundary. MCP tools now resolve feature identity and contract state before their handlers execute, preventing hidden defaults, ambiguous feature selection, and ungrounded generated artifacts.

## Highlights

### Signed Use-Case Contracts

Each feature persists a signed v5 state file containing its explicit lifecycle, workload, execution mode, capabilities, resolved phase graph, contract fingerprint, and HMAC signature. Specky supports 54 named lifecycle, workload, and mode contracts.

### Strict Execution Context

Feature-scoped tools require the selected feature and its valid signed state. Legacy root state is not used at runtime; migrate it with `specky migrate-contracts --dry-run` before applying the reviewed plan.

### Evidence-First Outputs

Documentation, diagrams, research, and turnkey specification flows accept explicit caller evidence and contract configuration. They fail closed when required evidence is absent instead of generating placeholder or inferred content.

### Safer Packaging and Cursor Plugin Writes

The build clears stale output before compilation, and the Cursor plugin writer includes the upstreamed race-condition and unsafe-type fixes from the latest `main` branch.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
specky doctor
```

For a workspace with legacy root state, review the deterministic migration plan first:

```bash
specky migrate-contracts --spec-dir=.specs --dry-run \
  --lifecycle=greenfield --workload=api --execution-mode=full \
  --capabilities='[]' --capability-config='{}'
```

Apply only the exact reviewed plan hash as documented by the CLI. See [Use-Case Contracts](https://github.com/paulasilvatech/specky/blob/main/docs/USE-CASE-CONTRACTS.md) for supported contracts and migration mappings.

## Validation

The release pipeline builds the package, validates manifests and primitives, generates the API reference, executes the test suite, inspects the npm tarball, and installs the packed artifact in clean workspaces. The published workflow also builds the multi-architecture GHCR image and creates a CycloneDX SBOM artifact.

## References

- [Specky documentation](https://github.com/paulasilvatech/specky/tree/main/docs)
- [Use-Case Contracts](https://github.com/paulasilvatech/specky/blob/main/docs/USE-CASE-CONTRACTS.md)
- [Publishing Specky](https://github.com/paulasilvatech/specky/blob/main/docs/PUBLISH.md)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)
