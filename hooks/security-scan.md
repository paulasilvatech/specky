---
name: security-scan
description: "Run security checklist against OWASP Top 10 and validate authentication patterns"
trigger: "before PR merge / after implementation"
model: claude-haiku-3.5
enabled: true
---

# Security Scan Hook

Validates implementation against OWASP Top 10 vulnerabilities, secrets detection, and authentication patterns before merge or deployment.

## Trigger Event

- PR submitted or marked as ready for review
- Implementation phase complete (TASK_STATUS = `implemented`)
- Pre-deployment verification requested

## Execution Steps

1. **Read implementation** from modified code files
2. **Scan for secrets** — API keys, tokens, credentials (regex patterns)
3. **Check OWASP Top 10** categories:
   - A1: Broken Access Control
   - A2: Cryptographic Failures
   - A3: Injection
   - A4: Insecure Design
   - A5: Security Misconfiguration
   - A6: Vulnerable Components
   - A7: Auth Failures
   - A8: Data Integrity
   - A9: Logging/Monitoring
   - A10: SSRF
4. **Validate auth patterns** — JWT, OAuth, session handling
5. **Generate report** in SECURITY_SCAN.md

## Output Format

```markdown
# Security Scan Report

Scanned: [files count]
Timestamp: [ISO]
Status: [PASS / WARNINGS / BLOCKED]

## Secrets Detected
- [list or "None found"]

## OWASP Findings
- A1: [risk level] - [finding]
- A3: [risk level] - [finding]

## Auth Pattern Review
- JWT validation: [status]
- Error messages: [no credential leaks? Y/N]

## Recommendations
1. [action]
```

## Model Configuration

- **Model:** claude-haiku-3.5 (fast, security-focused)
- **Temperature:** 0.1 (conservative, no false negatives)
- **Max tokens:** 2500

## Notes

- BLOCKED status prevents merge; WARNINGS require acknowledgment
- Use community security patterns (OWASP cheatsheets)
- Flag custom crypto or auth implementations for manual review
- Store scan reports in `reports/security/`
