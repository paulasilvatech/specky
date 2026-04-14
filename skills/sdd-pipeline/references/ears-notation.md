# EARS Notation Reference

## Easy Approach to Requirements Syntax (EARS)

EARS provides structured sentence patterns that eliminate ambiguity in requirements. Every requirement in the SDD pipeline MUST follow one of these patterns.

## The 6 Patterns

### 1. Ubiquitous

**Format:** `The system shall [action]`

**When to use:** Requirements that must always hold, with no conditions or triggers.

**Examples:**
- The system shall encrypt all data at rest using AES-256
- The system shall log every API request with a correlation ID
- The system shall validate all input on the server side

**REQ-ID format:** `REQ-{DOMAIN}-{NNN}` (e.g., `REQ-SEC-001`)

### 2. Event-Driven

**Format:** `When [event], the system shall [action]`

**When to use:** Requirements triggered by a specific event or user action.

**Examples:**
- When a user submits login credentials, the system shall validate them against the identity provider within 500ms
- When a payment fails, the system shall retry up to 3 times with exponential backoff
- When a file upload completes, the system shall generate a thumbnail

### 3. State-Driven

**Format:** `While [state], the system shall [action]`

**When to use:** Requirements that apply only while the system is in a particular state.

**Examples:**
- While the system is in maintenance mode, the system shall return HTTP 503 with an estimated recovery time
- While a user session is active, the system shall refresh the token every 15 minutes
- While offline, the system shall queue mutations for sync

### 4. Optional (Feature)

**Format:** `Where [condition], the system shall [action]`

**When to use:** Requirements that only apply when a feature or configuration is enabled.

**Examples:**
- Where multi-tenancy is enabled, the system shall isolate data by tenant ID
- Where the user has admin privileges, the system shall display the audit log
- Where GDPR compliance is required, the system shall support right-to-erasure

### 5. Unwanted (Negative)

**Format:** `If [unwanted condition], then the system shall [mitigation]`

**When to use:** Requirements about how the system handles failures, errors, or unwanted states.

**Examples:**
- If the database connection fails, then the system shall switch to read-only mode using the replica
- If an API rate limit is exceeded, then the system shall return HTTP 429 with Retry-After header
- If a user enters invalid input, then the system shall display specific validation errors without revealing internal details

### 6. Complex (Combined)

**Format:** `While [state], when [event], the system shall [action]`

**When to use:** Requirements that combine a state condition with an event trigger.

**Examples:**
- While the system is processing a batch job, when a higher-priority request arrives, the system shall pause the batch and serve the request
- While in degraded mode, when a health check succeeds, the system shall restore full functionality within 30 seconds

## EARS Validation Checklist

For every requirement, verify:

1. Follows exactly one EARS pattern (no mixing)
2. Has a unique REQ-ID in format `REQ-DOMAIN-NNN`
3. Uses "shall" (not "should", "will", "can", or "may")
4. Contains exactly one action per requirement
5. Has measurable acceptance criteria
6. References testable conditions (not vague like "fast" or "user-friendly")

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| "The system should..." | "Should" is ambiguous | Use "shall" |
| "The system shall be fast" | Not measurable | "shall respond within 200ms at p95" |
| "When X, do Y and Z" | Multiple actions | Split into two requirements |
| "The system shall handle errors" | Too vague | Specify which errors and what mitigation |
| Missing REQ-ID | Can't trace to tests | Add REQ-DOMAIN-NNN |
