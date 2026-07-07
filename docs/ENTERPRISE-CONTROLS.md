# Enterprise Controls

This document defines the enterprise control model for Specky. It separates current capabilities from target enforcement so the project can be audited honestly while hardening work progresses.

## Control Objectives

Specky should provide these enterprise guarantees:

1. Every tool call is authorized.
2. Every tool call is phase-aware.
3. Every write is auditable.
4. Every generated artifact is traceable to input, requirements, and version.
5. Every release is reproducible and evidence-backed.
6. Every compliance claim has a generated report or explicit manual assumption.

## Current Capability Matrix

| Control | Current Status | Gap |
| --- | --- | --- |
| Zod input schemas | Implemented | Keep schemas aligned with shared ID contracts. |
| State machine | Implemented and enforced via a central `registerTool` wrapper | Move to per-feature state files for true multi-feature isolation. |
| State write serialization | Implemented (per-spec-dir async mutex; atomic state + signature) | — |
| RBAC engine | Implemented and globally enforced; identity-based roles via HTTP token table (`SDD_HTTP_TOKENS_FILE`), token role beats `SDD_ROLE` | Continue expanding role policy coverage as new tools are added. |
| Audit logger | Implemented and globally attached; entries carry the authenticated principal; opt-in HMAC signing (`SDD_AUDIT_HMAC_KEY[_FILE]`) and fail-closed mode | Tail truncation needs external `current_hash` anchoring (documented). |
| Rate limiting | Implemented for HTTP mode; on by default under the enterprise profile | Bound the bucket map. |
| HTTP transport security | Loopback bind by default, bearer-token auth (shared token or named token table), DNS-rebinding protection | TLS termination via reverse proxy — see [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md). |
| Enterprise profile | Implemented (`profile: enterprise` / `SPECKY_PROFILE` / `--profile=`) — flips audit/RBAC/rate-limit/fail-closed defaults to ON; explicit config wins | — |
| Installer least-privilege | Minimal pre-authorized allow-list; no arbitrary shell/`rm`/network | Document opt-in for broader grants. |
| HMAC state signature | Implemented | Add user-facing state signature verification command/tool. |
| Audit chain verification | Implemented | Extend verification reporting into release evidence automation. |
| Compliance checks | Implemented as keyword controls | Integrate into semantic gate. |
| Cross-analysis | Implemented | Integrate into semantic gate. |
| Test traceability | Implemented | Integrate into verification and release gates. |
| Publish preflight | Script exists | Enforce in GitHub publish workflow. |

## Target Tool Execution Flow

```mermaid
sequenceDiagram
  participant Client as MCP Client
  participant Wrapper as Tool Enforcement Wrapper
  participant RBAC as RbacEngine
  participant State as StateMachine
  participant Audit as AuditLogger
  participant Tool as Tool Handler
  participant Files as FileManager

  Client->>Wrapper: tool call + input
  Wrapper->>RBAC: check role/tool
  RBAC-->>Wrapper: allow/deny
  Wrapper->>State: validate phase/tool
  State-->>Wrapper: allow/deny + phase
  Wrapper->>Audit: log start
  Wrapper->>Tool: execute validated handler
  Tool->>Files: read/write workspace-scoped artifacts
  Files-->>Tool: result
  Tool-->>Wrapper: response
  Wrapper->>Audit: log success/error
  Wrapper-->>Client: normalized response
```

## RBAC Policy

| Role | Access |
| --- | --- |
| Viewer | Read-only status, routing, context, metrics, templates, checkpoints list, audit verification. |
| Contributor | Authoring and analysis tools, excluding specky-release-gate operations. |
| Admin | All tools, including release, branch governance, and enterprise configuration. |

RBAC may remain opt-in for local use, but when enabled it must be enforced by the wrapper before any handler executes.

Role resolution precedence: **authenticated token role** (HTTP token table) > `SDD_ROLE` env (local stdio convenience) > `rbac.default_role`. An authenticated request ignores `SDD_ROLE` — a remote caller cannot out-vote its token. Deployment steps: [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md).

## Audit Policy

When `audit_enabled=true`, every tool execution should produce a hash-chained record containing:

- Timestamp
- Tool name
- Role
- Principal (authenticated identity, when available)
- Phase
- Spec directory
- Feature number when available
- Result status
- Input hash
- Output hash or error hash
- Previous hash
- HMAC-SHA256 signature (when an audit HMAC key is configured)

Sensitive file content and secrets must not be logged.

Tamper evidence: the plain hash chain detects corruption but can be recomputed by a workspace writer. With `SDD_AUDIT_HMAC_KEY[_FILE]` (key held outside the workspace) every entry is signed and `sdd_verify_audit` verifies both layers. With `audit.fail_closed=true` (enterprise default) a tool call is refused if its pre-execution audit entry cannot be written.

## Semantic Gate Policy

`sdd_run_analysis` should approve by evidence, not file presence alone.

Minimum evidence:

| Signal | Required For APPROVE |
| --- | --- |
| EARS compliance | Meets configured threshold |
| Requirement to design coverage | Meets configured threshold |
| Requirement to task coverage | Meets configured threshold |
| Task to test coverage | Meets configured threshold before release |
| Orphaned requirements | Zero, or accepted with documented waiver |
| Compliance controls | Required frameworks pass or have explicit waivers |
| Intent drift | Below configured threshold |
| Cognitive debt | Below configured threshold |

## Release Controls

Before publish:

1. `npm audit --audit-level=high`
2. `npm run build`
3. `npm test`
4. `npm run test:coverage`
5. `npm pack --dry-run`
6. Fresh install smoke test
7. MCP initialize handshake
8. Changelog/version check
9. Evidence pack update

## References

- [NIST Secure Software Development Framework (SSDF)](https://csrc.nist.gov/Projects/ssdf)
- [OWASP Software Component Verification Standard](https://owasp.org/www-project-software-component-verification-standard/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
