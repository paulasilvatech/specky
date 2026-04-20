# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.3.x   | ✅ Active  |
| 3.0.x–3.2.x | ✅ Security fixes only |
| 2.3.x   | ❌ End of life |
| 2.0.x   | ❌ End of life |
| 1.0.x   | ❌ End of life |

## Reporting a Vulnerability

If you discover a security vulnerability in Specky, please report it responsibly:

1. **Do NOT open a public issue.**
2. Email **paulasilvatech@github.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if any)
3. You will receive an acknowledgment within **48 hours**.
4. A fix will be released within **7 days** for critical issues.

## Security Architecture

### Input Validation

All 57 MCP tool inputs are validated using [Zod](https://zod.dev/) schemas with `.strict()` mode. No unknown fields are accepted. This prevents injection of unexpected parameters through the MCP JSON-RPC interface.

```
AI Client → JSON-RPC → Zod .strict() validation → Service layer
```

### Path Traversal Prevention

`FileManager` (the sole file I/O service) sanitizes all paths before any filesystem operation:

- Resolves paths relative to the workspace root
- Rejects paths containing `..` sequences
- Blocks access outside the designated workspace directory
- All file operations are scoped to `SDD_WORKSPACE` or the current working directory

### No Dynamic Code Execution

Specky does **not** use `eval()`, `Function()`, `vm.runInNewContext()`, or any dynamic code execution. Template rendering uses string replacement only — no template engines that execute code.

### No Network Calls

Specky operates entirely locally. It makes zero outbound network requests. All data stays on the user's machine. The MCP server communicates only via stdio (JSON-RPC over stdin/stdout) or optional HTTP transport on localhost.

### Dependency Minimalism

Specky has only **2 runtime dependencies**:

| Dependency | Purpose | Security Profile |
|------------|---------|------------------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | Official SDK from Anthropic |
| `zod` | Input schema validation | Zero dependencies, widely audited |

No transitive runtime dependencies beyond these two packages.

### Logging

- All log output goes to **stderr** — stdout is reserved for JSON-RPC protocol messages
- No sensitive data (credentials, tokens, file contents) is included in log messages
- Audit-relevant tool invocations are recorded only in the local `.specs/` directory

### OWASP Top 10 Coverage

| OWASP Category | Mitigation |
|----------------|------------|
| A01 Broken Access Control | Path sanitization in FileManager; workspace-scoped operations |
| A02 Cryptographic Failures | No cryptographic operations; no secrets handling |
| A03 Injection | Zod `.strict()` validation on all inputs; no SQL/eval/shell execution |
| A04 Insecure Design | State machine enforces phase ordering; thin tools / fat services separation |
| A05 Security Misconfiguration | Minimal config surface; no default credentials; no admin endpoints |
| A06 Vulnerable Components | 2 runtime deps only; Dependabot enabled; regular audits |
| A07 Authentication Failures | No authentication layer (local tool); MCP transport handles auth |
| A08 Data Integrity Failures | Atomic file writes via FileManager; Zod schema enforcement |
| A09 Logging Failures | Structured stderr logging; no stdout pollution |
| A10 SSRF | Zero outbound network requests |

## Dependency Auditing

```bash
# Check for known vulnerabilities
npm audit

# Check for outdated dependencies
npm outdated
```

We run `npm audit` in CI on every pull request. Any `high` or `critical` vulnerability blocks the merge.

## Security-Related Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `SDD_WORKSPACE` | Restricts file operations to this directory | Current working directory |
| `PORT` | HTTP transport port (when using `--http` mode) | 3200 |

When using HTTP transport mode (`--http`), bind to `localhost` only. Do not expose Specky to public networks without an authentication proxy.

## Secure Development Practices

- TypeScript `strict` mode enabled — no implicit `any`, no unchecked index access
- Zero `any` types in source code — enforced by CI
- All schemas use `.strict()` — rejects unknown fields
- `FileManager` is the sole I/O boundary — no direct `fs` calls in tools or other services
- No shell command execution — branch names and PR payloads are data only, not executed

## Security Best Practices for Users

### Always Use These Practices

| Practice | Details |
|----------|---------|
| **Use stdio mode by default** | `specky-sdd` (global install) — no network exposure, process-level isolation |
| **Never expose HTTP mode publicly** | `--http` mode has no authentication or TLS. If you need remote access, place behind a reverse proxy (nginx, Caddy, Traefik) with TLS and authentication |
| **Protect `.specs/` directory** | Contains architecture details, API contracts, security models. Add to `.gitignore` for sensitive projects, or use a private repository |
| **Protect `.checkpoints/`** | Contains full copies of all spec artifacts. Treat like source code |
| **Keep security-scan hook active** | `.claude/hooks/security-scan.sh` scans for hardcoded secrets and blocks commits (exit 2). Do not disable |
| **Review auto-generated specs** | `sdd_turnkey_spec` and `sdd_auto_pipeline` generate from natural language — review before committing to ensure no sensitive details leaked |
| **Use environment variables** | Never write actual secrets in spec artifacts. Reference them as `$VAR_NAME` |
| **Run `npm audit` regularly** | Catches dependency vulnerabilities in the 2 runtime dependencies |

### HTTP Deployment Checklist

If you must use HTTP mode (`--http`):

```
1. [ ] Bind to localhost only (default behavior)
2. [ ] Place behind reverse proxy with TLS (HTTPS)
3. [ ] Add authentication to the reverse proxy
4. [ ] Set firewall rules to restrict access
5. [ ] Use a unique PORT via environment variable
6. [ ] Monitor access logs on the reverse proxy
```

Example secure deployment with nginx:

```nginx
server {
    listen 443 ssl;
    server_name specky.internal.company.com;

    ssl_certificate     /etc/ssl/certs/specky.crt;
    ssl_certificate_key /etc/ssl/private/specky.key;

    # Require authentication
    auth_basic "Specky MCP Server";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_set_header Host $host;
    }
}
```

### Data Sensitivity Classification

| Data | Classification | Storage | Protection |
|------|---------------|---------|------------|
| CONSTITUTION.md | Internal | `.specs/` | Filesystem permissions |
| SPECIFICATION.md | Business Confidential | `.specs/` | May contain business logic — review before sharing |
| DESIGN.md | **Confidential** | `.specs/` | Contains architecture, API contracts, security model |
| TASKS.md | Internal | `.specs/` | Implementation plan |
| .checkpoints/*.json | **Confidential** | `.specs/.checkpoints/` | Full artifact snapshots |
| .sdd-state.json | Internal | `.specs/` | Pipeline metadata only |
| docs/journey-*.md | Business Confidential | `docs/` | Complete audit trail |
| Routing payloads | Transient | Memory only | Never persisted by Specky |

### What Specky Never Does

These are **architectural guarantees**, not configuration options:

- **Never makes outbound network calls** — zero HTTP/HTTPS/DNS from the Specky process
- **Never executes shell commands** — no `exec()`, `spawn()`, `eval()`, `Function()`
- **Never stores credentials** — no API keys, tokens, or passwords in any file
- **Never reads outside workspace** — `FileManager.sanitizePath()` enforces boundary
- **Never logs sensitive data** — logs go to stderr, contain only operational messages

See [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) for the complete security architecture with threat model.

## NPX Supply Chain Risk

Running `npx -y specky-sdd@latest` without a pinned version downloads the latest package from npm on every invocation. This creates a supply-chain exposure: a compromised npm registry entry or a typosquat could execute malicious code in your environment before Specky even starts.

**Recommended mitigations** (ordered by risk reduction):

| Approach | Risk reduction | Notes |
|----------|---------------|-------|
| `npm install -g specky-sdd@<pinned-version>` + `specky install` | **High** — fetched once, upgrades only when you explicitly run `npm install -g` again | Recommended for individual developers |
| `npm install --save-dev specky-sdd@<pinned-version>` + `npx specky install` | **Higher** — version-pinned in `package.json`; `package-lock.json` pins transitive deps | Best for teams (reproducible across clones) |
| Offline bundle: `npm pack specky-sdd@<version>` + `npm install ./specky-sdd-*.tgz` | **Higher** — no network access at install time after the initial download | Air-gapped environments |
| `specky doctor` after install | **Defense-in-depth** — verifies SHA256 of every installed file against `install.lock` | Run after every `install`/`upgrade` |
| Docker (`ghcr.io/paulasilvatech/specky:<version>`) | **Highest** — immutable image by digest | Best for CI/CD and air-gapped |

**Workspace isolation pattern** (CI/CD):

```bash
# Install into a local vendor directory — no global write permissions needed
npm install specky-sdd@3.4.0 --prefix ./vendor --ignore-scripts
./vendor/node_modules/.bin/specky install
./vendor/node_modules/.bin/specky doctor     # integrity check
```

**CLI binary entry points** (both ship in the same package):

- `specky` — unified CLI (`install`, `doctor`, `status`, `upgrade`, `hooks`, `serve`)
- `specky-sdd` — legacy alias; with no subcommand it routes to `specky serve` (MCP stdio server), preserving any existing `.mcp.json` configs that reference `specky-sdd` directly

**Install integrity check:**

Every `specky install` produces `.specky/install.lock` with SHA256 of every deployed file. `specky doctor` validates these hashes — a tampered hook script or agent file is detected before any agent runs.

The `--ignore-scripts` flag prevents npm lifecycle scripts from running during install, which is a common supply-chain attack vector.

## MCP Security Framework Compliance

### CoSAI MCP Security White Paper — Threat Category Coverage

Specky addresses the 12 threat categories from the CoSAI MCP Security White Paper:

| ID | Threat Category | Specky Mitigation |
|----|----------------|-------------------|
| T-01 | Tool Poisoning | Zod `.strict()` on all 57 tool inputs — no unknown fields accepted |
| T-02 | Prompt Injection via Tool Results | No user-controlled data interpolated into tool responses |
| T-03 | Excessive Tool Permissions | Thin Tools pattern — each tool does exactly one operation |
| T-04 | Insecure Data Storage | FileManager enforces workspace boundary; no secrets in files |
| T-05 | Insufficient Input Validation | All inputs validated with Zod schemas before reaching service layer |
| T-06 | Uncontrolled Resource Consumption | Rate limiter (opt-in) for HTTP mode; stdio is single-session |
| T-07 | Broken Access Control | RBAC engine (opt-in) — viewer/contributor/admin roles; path sanitization |
| T-08 | Supply Chain Compromise | 2 runtime deps only; Dependabot enabled; global install recommended |
| T-09 | Credential Leakage | No secrets in logs (stderr only); no credentials in spec artifacts |
| T-10 | Insecure Communication | stdio mode has zero network exposure; HTTP mode binds to localhost |
| T-11 | State Manipulation | HMAC-SHA256 signature on `.sdd-state.json`; tamper detection on load |
| T-12 | Audit Trail Integrity | Hash-chained JSONL audit log; rotation; syslog/OTLP export (opt-in) |

### OWASP MCP Top 10 Coverage

| # | OWASP MCP Risk | Specky Mitigation |
|---|---------------|-------------------|
| M1 | Prompt Injection | No dynamic content in tool descriptions; outputs are structured JSON |
| M2 | Insecure Tool Design | Thin Tools / Fat Services — tools are pure input/output wrappers |
| M3 | Excessive Agency | No shell execution, no outbound network, no code eval |
| M4 | Insufficient Authentication | HTTP mode delegates to reverse proxy; stdio is process-isolated |
| M5 | Broken Object-Level Authorization | RBAC engine enforces per-tool access by role (opt-in) |
| M6 | Sensitive Data Exposure | FileManager path boundary; no credential logging; workspace-scoped I/O |
| M7 | Insecure Plugin Composition | Fixed tool set at startup — no dynamic plugin loading |
| M8 | Improper Error Handling | All service errors caught; tools return structured error responses |
| M9 | Insufficient Logging | Hash-chained audit trail; syslog export available |
| M10 | Vulnerable Dependencies | 2 runtime deps; `npm audit` in CI; Dependabot on GitHub |
