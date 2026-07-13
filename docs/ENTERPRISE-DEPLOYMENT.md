# Enterprise Deployment Guide

> How to run Specky with enterprise controls: the opt-in **enterprise profile**,
> identity-based RBAC over HTTP, a tamper-evident audit trail, hosted and
> air-gapped deployment patterns, and CI enforcement.

**Specky is 100% open source (MIT), and enterprise mode is simply an opt-in
configuration profile of that same open-source package.** There is one npm
package (`specky-sdd`) and every security feature on this page ships in it for
everyone. The profile only changes *defaults*: standard keeps Specky
lightweight for individual use (all controls off); enterprise turns the
governance controls on by default. Nothing here is required to use Specky the
way you use it today.

---

## 1. Profiles

| Control | `standard` (default) | `enterprise` |
| --- | --- | --- |
| `audit_enabled` (hash-chained audit trail) | off | **on** |
| `audit.fail_closed` (refuse unaudited execution) | off | **on** |
| `rbac.enabled` (role checks before every tool) | off | **on** |
| `rate_limit.enabled` (HTTP token bucket) | off | **on** |
| Everything else (pipeline, gates, tools, EARS) | identical | identical |

The profile flips **defaults only** — an explicit value in `.specky/config.yml`
always wins. An enterprise deployment can still switch an individual control
off, and a standard user can enable any control without the profile:

```yaml
# .specky/config.yml
profile: enterprise
rate_limit:
  enabled: false        # explicit value overrides the enterprise default
```

### Enabling the profile

Three equivalent ways, with precedence **flag > env > config file**:

```bash
# 1. Per-project (committed with the repo)
echo "profile: enterprise" >> .specky/config.yml

# 2. Per-environment (works in containers/CI without touching the repo)
export SPECKY_PROFILE=enterprise      # or the shorthand: SPECKY_ENTERPRISE=1

# 3. Per-invocation
specky serve --http --profile=enterprise
```

On startup the server prints the resolved posture, so a misconfigured
deployment is visible in the first log line:

```text
[specky] Profile: enterprise — audit=on (fail_closed=on, hmac=on), rbac=on (default_role=contributor), rate_limit=on
```

---

## 2. Identity and RBAC

Specky has three roles enforced by the tool-enforcement wrapper **before any
handler executes** (see [ENTERPRISE-CONTROLS.md](ENTERPRISE-CONTROLS.md) for
the policy):

| Role | Access |
| --- | --- |
| `viewer` | Read-only tools (status, metrics, templates, audit verification) |
| `contributor` | Everything except specky-release-gate tools (`sdd_create_pr`) |
| `admin` | All 58 tools |

### Where the role comes from

Precedence: **authenticated token role > `SDD_ROLE` env > `rbac.default_role`**.

- **Local / stdio (single user).** The MCP client launches the server process,
  so the process owner *is* the identity. `SDD_ROLE=viewer|contributor|admin`
  sets the role per process; it is a convenience, not a security boundary —
  whoever starts the process controls its environment.
- **Hosted / HTTP (multiple users).** Roles must come from authentication, not
  from the environment. Configure a **token table** (below); each request's
  bearer token resolves to a named principal and role, and *an authenticated
  request ignores `SDD_ROLE` entirely* — a remote caller cannot out-vote its
  token.

### The token table (`SDD_HTTP_TOKENS_FILE`)

```yaml
# /etc/specky/tokens.yml — OUTSIDE the workspace, chmod 0600
tokens:
  - principal: alice
    role: admin
    token_sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
  - principal: ci-bot
    role: viewer
    token: "plaintext-also-works-but-prefer-sha256"
```

```bash
export SDD_HTTP_TOKENS_FILE=/etc/specky/tokens.yml
specky serve --http --profile=enterprise
```

- `token_sha256` is recommended: the server file never stores the secret.
  Generate a token and its hash with:

  ```bash
  TOKEN=$(openssl rand -hex 24)
  echo "token:  $TOKEN"
  echo "sha256: $(printf %s "$TOKEN" | openssl dgst -sha256 -r | cut -d' ' -f1)"
  ```

- Loading is **fail-closed**: a configured file that is missing or malformed
  aborts startup instead of silently accepting everyone.
- Tokens are compared in constant time; every entry is evaluated on every
  request so timing does not reveal match position.
- The file must live **outside the workspace** — a token table writable from
  the workspace would let workspace writers mint themselves a role.
- Requests without a valid token get `401` (the `/health` probe stays open).
- The denied-response and every audit entry carry the **principal**, so
  `access_denied` events are attributable to a person, not just a role.

**Back-compat:** `SDD_HTTP_TOKEN` (one shared token, no identity) still works
when no token table is configured; RBAC then falls back to
`SDD_ROLE`/`default_role`. Once a table is configured, only named tokens are
accepted.

**Session model:** the HTTP transport runs one MCP session; identity is
resolved **per request** from the `Authorization` header, so multiple
principals can share the session while each call is authorized and audited as
its own caller.

### Verifying access

The `sdd_check_access` tool reports the caller's resolved identity — use it to
debug RBAC from the client side:

```json
{
  "rbac_enabled": true,
  "active_role": "viewer",
  "principal": "bob",
  "role_source": "authenticated token (SDD_HTTP_TOKENS_FILE)"
}
```

---

## 3. Tamper-evident audit trail

With `audit_enabled: true`, every tool call (including denied ones) appends a
hash-chained JSONL entry to `<spec_dir>/.audit.jsonl` — timestamp, tool, phase,
role, **principal**, result, input/output hashes, `previous_hash`.

The plain hash chain detects *accidental* corruption, but an attacker with
workspace write access can rewrite the file and recompute the chain. Closing
that gap requires a secret the workspace never sees:

### HMAC signing

```bash
# Key held OUTSIDE the workspace (secret manager, systemd credential, 0600 file)
export SDD_AUDIT_HMAC_KEY_FILE=/etc/specky/audit.key    # or SDD_AUDIT_HMAC_KEY=<key>
```

When a key is configured, every entry gains an `hmac` field — HMAC-SHA256 over
the serialized entry, which includes `previous_hash`, so signatures chain too.
`sdd_verify_audit` then checks both layers:

```json
{
  "valid": true,
  "total_entries": 8,
  "signed_entries": 8,
  "hmac_checked": true,
  "current_hash": "…"
}
```

- Entries written **without** the key are flagged once a key is configured
  (`missing hmac`) — start signing at a log-rotation boundary, or accept the
  flagged pre-key history.
- A verifier **without** the key still validates the plain hash chain
  (`hmac_checked: false`).
- **Known limitation — truncation:** deleting entries from the *tail* of the
  log is not detectable by chain or HMAC alone. Anchor the `current_hash`
  reported by `sdd_verify_audit` somewhere outside the workspace on a schedule
  (CI job output, ticket comment, WORM storage) and compare on the next audit.

### Fail-closed auditing

Enterprise default (`audit.fail_closed: true`): if the **pre-execution** audit
entry cannot be written, the tool call is refused with `audit_unavailable` —
no unaudited actions. Post-execution audit failures cannot un-run the tool;
they are surfaced on stderr while the result is still returned. Standard
profile keeps the historical fail-open behavior (audit failures never break
tool calls).

---

## 4. Hosted deployment (`serve --http`)

The HTTP transport is loopback-only by default and designed to sit behind a
TLS-terminating reverse proxy:

```bash
SPECKY_PROFILE=enterprise \
SDD_WORKSPACE=/srv/specky/workspace \
SDD_HTTP_TOKENS_FILE=/etc/specky/tokens.yml \
SDD_AUDIT_HMAC_KEY_FILE=/etc/specky/audit.key \
specky serve --http --port=3200            # binds 127.0.0.1
```

- **Never expose the port directly.** Keep the `127.0.0.1` bind and proxy TLS
  to it (nginx, Caddy, Traefik), or use `--host=0.0.0.0` only inside a private
  network/container where the proxy is the sole ingress. A non-loopback bind
  without a token prints a loud warning.
- DNS-rebinding protection is on: requests must carry an allowed `Host`.
- `rate_limit` (enterprise default on) applies a per-client token bucket to
  `/mcp`: `429` + `Retry-After` when exceeded.
- `GET /health` returns `{"status":"ok","version":"…"}` unauthenticated — point
  your liveness probe at it.

### systemd unit (sketch)

```ini
[Service]
Environment=SPECKY_PROFILE=enterprise
Environment=SDD_WORKSPACE=/srv/specky/workspace
Environment=SDD_HTTP_TOKENS_FILE=/etc/specky/tokens.yml
Environment=SDD_AUDIT_HMAC_KEY_FILE=/etc/specky/audit.key
ExecStart=/usr/bin/npx -y specky-sdd@latest serve --http
Restart=on-failure
User=specky
```

### Container

Two supported paths: run the pre-built, multi-arch image from GHCR, or build
the hardened `Dockerfile` from source (multi-stage, non-root, healthcheck on
`/health`, `CMD serve --http`).

#### Run the published GHCR image

The image is published multi-arch (`linux/amd64` + `linux/arm64`) and binds
`0.0.0.0:3200` inside the container so Docker port publishing works out of the
box. `GET /health` stays unauthenticated for liveness probes.

```bash
# Public package: no login needed. Pin a release tag for reproducible deploys.
docker pull ghcr.io/paulasilvatech/specky:3.11.0            # or :latest

# Hardened run: enterprise profile + token auth behind your TLS proxy
docker run --rm -p 127.0.0.1:3200:3200 \
  -e SPECKY_PROFILE=enterprise \
  -e SDD_HTTP_TOKENS_FILE=/run/secrets/tokens.yml \
  -e SDD_AUDIT_HMAC_KEY_FILE=/run/secrets/audit.key \
  -v "$PWD/workspace:/workspace" \
  -v /etc/specky:/run/secrets:ro \
  ghcr.io/paulasilvatech/specky:3.11.0

curl -s http://127.0.0.1:3200/health     # -> {"status":"ok","version":"3.11.0"}
```

If the package is **private**, authenticate first with a token that has
`read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```

#### Build from source

```bash
docker build -t specky-sdd .
docker run --rm -p 127.0.0.1:3200:3200 \
  -e SPECKY_PROFILE=enterprise \
  -e SDD_HTTP_TOKENS_FILE=/run/secrets/tokens.yml \
  -e SDD_AUDIT_HMAC_KEY_FILE=/run/secrets/audit.key \
  -v "$PWD/workspace:/workspace" \
  -v /etc/specky:/run/secrets:ro \
  specky-sdd
```

> **Security:** even though the image binds `0.0.0.0` internally, never expose
> the port directly. Terminate TLS at a reverse proxy and require
> `SDD_HTTP_TOKEN`/`SDD_HTTP_TOKENS_FILE`. A non-loopback bind without a token
> prints a loud warning.

Publishing to GHCR (multi-arch build with a CycloneDX SBOM workflow artifact and
optional Cosign signatures when signing secrets are configured) is wired in
`.github/workflows/publish.yml` behind the `PUBLISH_DOCKER` repository variable.
See [PUBLISH.md](PUBLISH.md) for the maintainer publish + manual fallback workflow.

---

## 5. Air-gapped and mirrored installs

Specky's MCP server (`specky serve`) makes **zero outbound network calls** once
running. The CLI may optionally check the npm registry once per day for update
banners — disable with `SPECKY_NO_UPDATE_CHECK=1` or `update_check: false` in
`.specky/config.yml` for a strict air-gapped posture.

**Tarball transfer (fully air-gapped):**

```bash
# Connected machine
npm pack specky-sdd@latest        # → specky-sdd-<version>.tgz
npm audit signatures              # verify npm provenance before transferring

# Air-gapped machine
npm install -g ./specky-sdd-<version>.tgz
export SPECKY_NO_UPDATE_CHECK=1
specky install --target=cursor     # or copilot, claude, opencode
```

**MCP registration (avoid `npx` on air-gapped hosts):** point
`.mcp.json` / `.vscode/mcp.json` at the global binary:

```json
{ "mcpServers": { "specky": { "command": "specky", "args": ["serve"] } } }
```

The default installer writes `npx -y specky-sdd@<version> serve`, which can
reach the network if the package is not cached.

**Private registry mirror (Artifactory, Nexus, Verdaccio):**

```bash
npm config set registry https://registry.your-company.example
npm install -g specky-sdd@latest
```

The published package carries **npm provenance** (built by GitHub Actions from
this repo), so mirrors can verify origin with `npm audit signatures`.

---

## 6. CI enforcement

Use the bundled `specky-verify` pattern
([examples/specky-verify.example.yml](../examples/specky-verify.example.yml))
to make the quality gate a merge gate: it validates EARS compliance and runs
`sdd_run_analysis` on every pull request, failing the check on
`CHANGES_NEEDED`/`BLOCK`. Combined with `audit_enabled`, this gives you a
reviewable, hash-chained record from requirement to release.

---

## 7. Reference — enterprise configuration surface

### `.specky/config.yml`

```yaml
profile: enterprise            # standard | enterprise (default: standard)
audit_enabled: true            # hash-chained audit trail
audit:
  export_format: jsonl         # jsonl | syslog | otlp(stub)
  max_file_size_mb: 10         # rotation threshold (keeps 3 rotations)
  fail_closed: true            # refuse execution if audit can't be written
rbac:
  enabled: true
  default_role: contributor    # viewer | contributor | admin
rate_limit:
  enabled: true
  max_requests_per_minute: 60
  burst: 10
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SPECKY_PROFILE` | `standard` or `enterprise` (beats config.yml) |
| `SPECKY_ENTERPRISE` | `1` — shorthand for `SPECKY_PROFILE=enterprise` |
| `SDD_WORKSPACE` | Workspace root (default: cwd) |
| `SDD_ROLE` | Local role for stdio use (ignored on authenticated requests) |
| `SDD_HTTP_TOKEN` | Shared bearer token (no identity) for `--http` |
| `SDD_HTTP_TOKENS_FILE` | YAML token table → principal + role (identity-based RBAC) |
| `SDD_AUDIT_HMAC_KEY` | HMAC key for tamper-evident audit entries |
| `SDD_AUDIT_HMAC_KEY_FILE` | Same, read from a file kept outside the workspace |
| `SDD_HTTP_HOST` / `--host=` | Bind address (default `127.0.0.1`) |
| `PORT` / `--port=` | HTTP port (default `3200`) |

### What stays out of scope (honest limits)

- **No TLS in-process** — terminate TLS at a reverse proxy.
- **No SSO/SAML/OIDC** — token table only; federated identity is on the
  [roadmap](../README.md#roadmap).
- **Audit-tail truncation** requires external anchoring (see §3).
- **stdio mode has no authentication layer** — the process boundary is the
  boundary; use HTTP + tokens for shared deployments.

See also: [SECURITY.md](../SECURITY.md) · [ENTERPRISE-CONTROLS.md](ENTERPRISE-CONTROLS.md) ·
[CLI.md](CLI.md) · [INSTALL.md](INSTALL.md)
