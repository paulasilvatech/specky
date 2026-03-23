# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.1.x   | ✅ Active  |
| 2.0.x   | ✅ Security fixes only |
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

All 44 MCP tool inputs are validated using [Zod](https://zod.dev/) schemas with `.strict()` mode. No unknown fields are accepted. This prevents injection of unexpected parameters through the MCP JSON-RPC interface.

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
