# Specky 3.5.0 — Enterprise mode (opt-in)

> Copy-paste body for the GitHub Release `v3.5.0`.

**Specky is 100% open source (MIT) — enterprise mode is just an opt-in profile
of the same package.** `3.5.0` adds the `enterprise` configuration profile plus
identity-based RBAC and a tamper-evident audit trail, all shipped in
`specky-sdd` for everyone. Everything is **default OFF** — the standard profile
behaves exactly like 3.4.0.

## Highlights

### 🏢 Enterprise profile
```yaml
# .specky/config.yml
profile: enterprise
```
…or `SPECKY_PROFILE=enterprise` / `SPECKY_ENTERPRISE=1` / `specky serve --profile=enterprise`.
Flips the **defaults** of `audit_enabled`, `rbac.enabled`, `rate_limit.enabled`,
and the new `audit.fail_closed` to ON. Explicit config values always win, and
the server prints the resolved posture at startup.

### 🪪 Identity-based RBAC over HTTP
`SDD_HTTP_TOKENS_FILE=/etc/specky/tokens.yml` maps each bearer token (plaintext
or `token_sha256`) to a named **principal** and **role**. Constant-time
compares, fail-closed loading, and strict precedence: **token role >
`SDD_ROLE` > `default_role`** — a remote caller can't out-vote its token.
Denials and audit entries record *who*, not just which role. The shared
`SDD_HTTP_TOKEN` keeps working unchanged.

### 🔏 Tamper-evident audit trail
Set `SDD_AUDIT_HMAC_KEY[_FILE]` (key held **outside** the workspace) and every
audit entry is HMAC-SHA256-signed with chained signatures. `sdd_verify_audit`
now checks both the hash chain and the signatures (`hmac_checked`,
`signed_entries`) — a workspace writer who rewrites the log and recomputes the
plain chain is detected. With `audit.fail_closed: true` (enterprise default),
a tool call is refused if its pre-execution audit entry cannot be written.

### 📘 New guide: docs/ENTERPRISE-DEPLOYMENT.md
Profiles · token table setup with hash generation · HMAC audit + external
anchoring · hosted `serve --http` behind TLS (systemd/container examples) ·
air-gapped tarball + private-registry installs · CI enforcement · full env-var
reference · honest out-of-scope list (no in-process TLS, no SSO yet).

## Verified end-to-end

Booted the real server in enterprise profile with a two-principal token table
and an HMAC key: 401 without/with wrong token; viewer principal allowed on read
tools and denied (`access_denied`, principal recorded) on `sdd_init` even with
`SDD_ROLE=admin` in the server env; admin principal ran the pipeline; every
audit entry signed; `sdd_verify_audit` → `valid: true, hmac_checked: true`.

## Compatibility

- **No breaking changes.** Standard profile = 3.4.0 behavior, byte for byte.
- `AuditLogger` gained an options-object constructor; the old positional
  signature still works.
- New config keys: `profile`, `audit.fail_closed`. New env vars:
  `SPECKY_PROFILE`, `SPECKY_ENTERPRISE`, `SDD_HTTP_TOKENS_FILE`,
  `SDD_AUDIT_HMAC_KEY`, `SDD_AUDIT_HMAC_KEY_FILE`.

## Install / upgrade

```bash
npm install -g specky-sdd@latest   # 3.5.0
cd your-project && specky upgrade  # refreshes assets, preserves .specs/
```

Full details: [CHANGELOG.md](../CHANGELOG.md) · [docs/ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md)
