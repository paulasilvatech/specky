---
title: EARS Notation Guide for Specification Writing
version: 1.0.0
date: 2026-03-20
author: Claude
description: Complete reference for Easy Approach to Requirements Syntax (EARS)
---

# EARS Notation Guide

## Introduction

**EARS** (Easy Approach to Requirements Syntax) is a standardized template-based notation for writing clear, unambiguous, testable requirements. This guide provides complete patterns with examples, keywords, and anti-patterns.

## Core Principle

Every requirement answers three questions:
1. **When/Where** does this apply? (Context)
2. **What** shall the system do? (Action)
3. **Why** matters? (Acceptance criteria)

Structure: `[Context] The [system] shall [action] [constraints]`

---

## Six EARS Requirement Patterns

### Pattern 1: Ubiquitous Requirements

**Usage:** Requirements that apply at all times, everywhere, with no special conditions

**Template:**
```
The [system] shall [action].
```

**Examples:**

**Example 1.1: Basic Authentication**
```
The system shall authenticate users via email and password.
```
✅ **Good:** Clear action, no ambiguity
- Acceptance Criteria: User can successfully log in with valid email + password
- Test: curl -X POST /auth/login with valid credentials → 200 OK + token

**Example 1.2: API Response Format**
```
The system shall return all API responses in JSON format.
```
✅ **Good:** Defines standard for all endpoints
- Acceptance Criteria: Every API endpoint response is valid JSON
- Test: Validate response headers include "Content-Type: application/json"

**Example 1.3: Data Encryption**
```
The system shall encrypt all personally identifiable information (PII) at rest.
```
✅ **Good:** Clear scope (PII), clear requirement (encryption)
- Acceptance Criteria: All PII in database is encrypted with AES-256
- Test: Dump database; verify PII fields are unreadable

**Example 1.4: Anti-Example (Vague)**
```
❌ The system shall be easy to use.
Problem: "Easy" is subjective, not testable
Better: The system shall enable user account creation in <3 clicks
```

---

### Pattern 2: Event-Driven Requirements

**Usage:** Requirements triggered by a specific event or condition

**Template:**
```
When [event], the [system] shall [action].
```

**Examples:**

**Example 2.1: Login with Incorrect Password**
```
When a user submits an incorrect password, the system shall return 
a 401 Unauthorized error and NOT increment the login attempt counter 
until the email is correct.
```
✅ **Good:** Specifies trigger (incorrect password), action (401), and constraint
- Acceptance Criteria: Error returned immediately; counter only increments for valid email
- Test: Submit wrong password 3x → 401 each time; 4th attempt not rate-limited

**Example 2.2: Token Expiration**
```
When a user's JWT token expires, the system shall invalidate the token 
and require re-authentication on the next request.
```
✅ **Good:** Trigger (expiry), action (invalidate), requirement (re-auth)
- Acceptance Criteria: Expired token returns 401 Unauthorized
- Test: Wait 15+ minutes; attempt authenticated request → 401 Unauthorized

**Example 2.3: Payment Failure**
```
When a Stripe payment charge fails, the system shall:
1. Log the failure with error code and timestamp
2. Notify the user via email within 5 minutes
3. Mark the order as PAYMENT_FAILED
4. Queue retry attempt for 24 hours later
```
✅ **Good:** Multiple outcomes for single event, all testable
- Acceptance Criteria: All 4 actions occur in sequence
- Test: Simulate Stripe payment failure; verify logs, email, order status, queue entry

**Example 2.4: Anti-Example (Missing Context)**
```
❌ When a user logs in, the system shall authenticate them.
Problem: "Authenticate them" is vague (method? algorithm? response?)
Better: When a user submits email and password, the system shall 
verify credentials against the user database and return a JWT token.
```

---

### Pattern 3: State-Driven Requirements

**Usage:** Requirements that apply while the system is in a particular state

**Template:**
```
While [state], the [system] shall [action].
```

**Examples:**

**Example 3.1: System Maintenance**
```
While the system is in MAINTENANCE mode, the system shall:
1. Return HTTP 503 Service Unavailable to all requests
2. Display maintenance page to users
3. Queue API requests for processing after maintenance ends
4. NOT process payments or critical transactions
```
✅ **Good:** Defines behavior for entire state, multiple outcomes
- Acceptance Criteria: All 4 behaviors occur when status = MAINTENANCE
- Test: Set system to MAINTENANCE mode; verify 503, queue, no payments

**Example 3.2: Network Failure**
```
While the database connection is unavailable, the system shall:
1. Return cached responses for recently accessed data (max 1 hour old)
2. Queue write operations in Redis for replay after connection restores
3. Log warnings every 30 seconds
```
✅ **Good:** Graceful degradation pattern with fallback behavior
- Acceptance Criteria: Cache serves reads; writes queue; logs appear
- Test: Disconnect database; verify cache hits, queue depth, log frequency

**Example 3.3: Peak Load Condition**
```
While system load exceeds 80% CPU utilization, the system shall 
implement aggressive rate limiting (10 requests/minute per user) 
and auto-scale to additional server instances.
```
✅ **Good:** Adaptive behavior based on measurable state
- Acceptance Criteria: Rate limiting triggers at 80%+ CPU; new instances start
- Test: Generate load to 80%+ CPU; verify rate limiting, scale-up events

**Example 3.4: Anti-Example (Unclear State)**
```
❌ While the user is active, the system shall keep their session alive.
Problem: "Active" is undefined (last keystroke? API call? page view?)
Better: While a user has made an API request in the last 15 minutes, 
the system shall extend their session timeout another 15 minutes.
```

---

### Pattern 4: Optional Requirements

**Usage:** Requirements that apply only under specific conditions

**Template:**
```
Where [condition], the [system] shall [action].
```

**Examples:**

**Example 4.1: Enterprise Accounts**
```
Where the user account type is ENTERPRISE, the system shall:
1. Enforce single sign-on (SSO) via SAML 2.0
2. Disable password-based login
3. Restrict access to IP address whitelist
4. Provide audit logging of all user actions
```
✅ **Good:** Feature toggle for specific user segment
- Acceptance Criteria: Conditional logic applied only to ENTERPRISE accounts
- Test: Compare ENTERPRISE user vs standard user; verify SSO, no passwords, audit logs

**Example 4.2: High-Value Transactions**
```
Where a payment amount exceeds $10,000, the system shall:
1. Require manual approval from a merchant
2. Send email notification to merchant
3. Hold payment in PENDING_APPROVAL status
4. Expire hold after 48 hours if not approved
```
✅ **Good:** Conditional workflow based on numeric threshold
- Acceptance Criteria: Workflow only triggers for >$10K; all steps occur
- Test: Create $5K payment (normal flow); create $15K payment (approval flow)

**Example 4.3: Mobile Clients**
```
Where the API client is a mobile application (User-Agent contains "mobile"), 
the system shall return paginated results (max 50 items per page) 
to reduce bandwidth consumption.
```
✅ **Good:** Conditional optimization based on client type
- Acceptance Criteria: Desktop clients get unpaginated results; mobile gets 50-item pages
- Test: Call API with desktop User-Agent vs mobile User-Agent; verify pagination

**Example 4.4: Anti-Example (Too Many Conditions)**
```
❌ Where the user is in the US and the time is between 9 AM and 5 PM 
and it's a weekday and the user has made >10 purchases and... 
the system shall apply a discount.
Problem: Too complex; hard to test; maintenance nightmare
Better: Where the user is a Premium member, the system shall apply 
a 10% discount to all purchases.
```

---

### Pattern 5: Unwanted Behavior Requirements

**Usage:** Requirements that specify what the system shall NOT do (negative requirements)

**Template:**
```
If [unwanted condition], the [system] shall [prevention action].
```

**Examples:**

**Example 5.1: Duplicate Payments**
```
If a payment request is submitted twice with identical amount and user 
within 60 seconds, the system shall reject the second request with 
error code DUPLICATE_PAYMENT and NOT charge the customer twice.
```
✅ **Good:** Specifies unwanted condition, prevention, error code
- Acceptance Criteria: Duplicate detection works; second charge prevented
- Test: Submit same payment 2x rapidly; verify second is rejected, only 1 charge

**Example 5.2: SQL Injection**
```
If user input contains SQL metacharacters (', ", --, ;), the system 
shall escape or parameterize the input before executing database queries 
to prevent SQL injection attacks.
```
✅ **Good:** Specifies security threat, mitigation technique
- Acceptance Criteria: All user inputs sanitized before database access
- Test: Submit ' or 1=1 -- as input; verify no SQL injection

**Example 5.3: Expired Tokens**
```
If a user attempts to use an expired access token, the system shall 
reject the request with 401 Unauthorized and NOT process the requested action.
```
✅ **Good:** Clear unwanted scenario, clear prevention
- Acceptance Criteria: Expired tokens always rejected; no transaction processing
- Test: Create token, wait 15+ minutes, attempt API call; verify 401

**Example 5.4: Concurrent Modifications**
```
If two users attempt to modify the same record simultaneously, the 
system shall implement optimistic locking and return 409 Conflict 
to the second user rather than allowing data corruption.
```
✅ **Good:** Specifies concurrency scenario, conflict resolution
- Acceptance Criteria: Concurrent edits detected; second edit fails gracefully
- Test: Open 2 sessions, edit same record simultaneously; second gets 409

**Example 5.5: Anti-Example (Too Vague)**
```
❌ If something bad happens, the system shall not crash.
Problem: "Something bad" undefined; "crash" is vague (error log? downtime?)
Better: If a required external API is unreachable, the system shall 
log an error and continue processing from cached data, but shall NOT 
stop responding to user requests.
```

---

### Pattern 6: Complex Requirements (Combinations)

**Usage:** Requirements combining multiple patterns for nuanced scenarios

**Template:**
```
[Pattern 1] ... [Pattern 2] ... [Pattern 3]
```

**Examples:**

**Example 6.1: Multi-Part Authorization**
```
When a user with ADMIN role attempts to delete a production database backup, 
where that backup contains customer PII, the system shall:
1. Require secondary approval from another ADMIN (not the initiator)
2. Log the deletion request with both admin names, timestamp, and reason
3. If no secondary approval is received within 24 hours, automatically 
   deny the deletion and notify both admins
4. If deletion is approved, execute the deletion and email both admins 
   with deletion confirmation within 5 minutes
```
✅ **Good:** Combines event (deletion attempt), state (ADMIN role), condition (PII backup), with multiple outcomes
- Acceptance Criteria: Secondary approval required; logging; timeout; notification
- Test: Delete backup as ADMIN1; verify approval prompt; approve as ADMIN2; verify logs and email

**Example 6.2: Failover Behavior**
```
When the primary database becomes unavailable while the system is handling 
active user requests, the system shall:
1. Detect unavailability within 30 seconds (via health check)
2. Failover to standby database
3. Replay queued writes from the last 5 minutes
4. Notify ops team via Slack
5. If failover fails, return 503 Service Unavailable to clients (rather than 500 Internal Server Error)
6. Continue retrying failover every 10 seconds until successful
```
✅ **Good:** Multi-step recovery procedure with timeout, fallback, notification
- Acceptance Criteria: Failover detection, standby activation, queue replay, notification, graceful degradation
- Test: Kill primary DB; verify failover <30s, replay succeeds, clients get 503

**Example 6.3: Feature Rollout**
```
Where a feature flag "new_checkout_flow" is enabled for a user, 
when that user navigates to the checkout page, the system shall:
1. Display the NEW checkout interface (v2)
2. Route payment requests to the NEW payment processor (Stripe)
3. If the new processor fails, fall back to the OLD processor silently 
   and log the fallback event (no error to user)
4. After successful payment via new processor, display a survey asking 
   for feedback on the new experience
5. Collect feature metrics (conversion rate, error rate) separately 
   from old interface metrics
```
✅ **Good:** Feature flag logic + fallback + analytics
- Acceptance Criteria: Feature flag logic works; fallback silent; metrics tracked
- Test: Enable feature flag for test user; complete checkout; verify metrics

---

## RFC 2119 Keywords

All EARS requirements use standardized keywords from RFC 2119 to express requirement strength:

### SHALL (MUST)
**Definition:** Absolute requirement; implementation is mandatory

**Usage:** All critical functionality must use "shall"

**Examples:**
- "The system **shall** authenticate users via email and password."
- "All API responses **shall** be valid JSON."
- "The system **shall** encrypt PII at rest."

**Testing:** Test MUST pass; failure is a bug

---

### SHOULD (RECOMMENDED)
**Definition:** Strongly recommended but not mandatory; implementation is expected unless there's good reason not to

**Usage:** Best practices, preferred patterns

**Examples:**
- "The system **should** log all authentication attempts."
- "The system **should** return responses in <100ms (median latency)."
- "The system **should** include request IDs in all responses for traceability."

**Testing:** Test SHOULD pass; failure is a concern but acceptable with documented rationale

---

### MAY (OPTIONAL)
**Definition:** Truly optional; implementation is discretionary; provides flexibility

**Usage:** Nice-to-have features, optimization strategies

**Examples:**
- "The system **may** cache recently accessed user profiles."
- "The system **may** support multiple languages in future versions."
- "The system **may** offer dark mode UI theme."

**Testing:** Test MAY pass or fail; feature is optional

---

### SHALL NOT (MUST NOT)
**Definition:** Absolute prohibition; implementation of this action is forbidden

**Usage:** Security constraints, safety requirements

**Examples:**
- "The system **shall not** store passwords in plaintext."
- "The system **shall not** process expired tokens."
- "The system **shall not** allow SQL injection attacks."

**Testing:** Test MUST verify violation is prevented

---

### Keyword Decision Table

| Strength | RFC 2119 | Use When | Example |
|----------|----------|----------|---------|
| Mandatory | SHALL | Critical functionality, legal requirement, core feature | "System shall authenticate users" |
| Mandatory | SHALL NOT | Security, safety, compliance | "System shall not store passwords plaintext" |
| Strong | SHOULD | Best practice, preferred pattern, almost always implemented | "System should log auth attempts" |
| Weak | MAY | Optional, nice-to-have, flexibility needed | "System may cache user profiles" |

---

## Complete Example: User Authentication Feature

**Feature:** Email-based login for consumer accounts

**EARS Requirements:**

```markdown
### REQ-AUTH-001: Basic Email/Password Authentication
The system shall authenticate users via email address and password.

### REQ-AUTH-002: Password Hashing
The system shall hash passwords using bcryptjs (10+ salt rounds) 
and shall NOT store plaintext passwords in any form (database, logs, backups).

### REQ-AUTH-003: Invalid Credentials Response
When a user submits invalid credentials, the system shall return 
HTTP 401 Unauthorized with generic error message "Invalid email or password" 
(to prevent email enumeration attacks).

### REQ-AUTH-004: Rate Limiting
When a user exceeds 5 failed login attempts within 60 seconds, 
the system shall enforce rate limiting and return HTTP 429 Too Many Requests 
for subsequent attempts from that email address.

### REQ-AUTH-005: JWT Token Issuance
When a user successfully authenticates, the system shall issue a JWT token 
signed with HS256, with 15-minute expiry, containing user_id and email claims.

### REQ-AUTH-006: Token Validation
When a user sends an API request with a valid JWT token in the Authorization header, 
the system shall validate the signature and expiry, and proceed with the request.

### REQ-AUTH-007: Expired Token Handling
If a user attempts to use an expired token, the system shall reject the request 
with HTTP 401 Unauthorized and require re-authentication.

### REQ-AUTH-008: Login Latency
When a user authenticates with valid credentials, the system shall respond 
with token within 500ms (p99 latency), even during peak load (1000 concurrent users).

### REQ-AUTH-009: HTTPS Enforcement
Where the client connects via plain HTTP, the system shall redirect to HTTPS 
to prevent token interception over unencrypted connections.

### REQ-AUTH-010: Logging
The system shall log all authentication attempts (both successful and failed) 
with timestamp, email, and IP address, should support audit trail for security investigation.

### REQ-AUTH-011: Concurrent Login
When a user logs in from multiple devices simultaneously, the system 
shall allow concurrent sessions (no forced logout on subsequent login).

### REQ-AUTH-012: Mobile Client Support
Where the API client is a mobile application, the system may implement 
refresh token rotation strategy (optional enhancement for long-lived sessions).
```

---

## Anti-Patterns: What NOT To Do

### Anti-Pattern 1: Vague Action Verbs

**❌ Bad:**
```
The system shall handle user input.
```
**Problem:** "Handle" is ambiguous (validate? store? display? sanitize?)

**✅ Better:**
```
The system shall validate user email address against RFC 5322 format 
and display error message if invalid.
```

---

### Anti-Pattern 2: Missing Acceptance Criteria

**❌ Bad:**
```
When a user logs in, the system shall authenticate them.
```
**Problem:** "Authenticate" not testable (what counts as success?)

**✅ Better:**
```
When a user submits email and password, the system shall verify credentials 
against the database and return HTTP 200 with JWT token if valid, 
HTTP 401 if invalid.
```

---

### Anti-Pattern 3: Unclear Scope

**❌ Bad:**
```
The system shall be secure.
```
**Problem:** Too broad; what security aspect?

**✅ Better:**
```
The system shall encrypt all personally identifiable information at rest 
using AES-256 encryption.
```

---

### Anti-Pattern 4: Combining Multiple Unrelated Actions

**❌ Bad:**
```
The system shall handle authentication, authorization, and logging.
```
**Problem:** Three different concerns lumped into one requirement

**✅ Better:** Separate into three requirements:
```
REQ-001: The system shall authenticate users via email and password.
REQ-002: The system shall authorize users based on role (ADMIN, USER, GUEST).
REQ-003: The system shall log all authentication attempts with timestamp and email.
```

---

### Anti-Pattern 5: Untestable Performance Claims

**❌ Bad:**
```
The system shall be fast.
```
**Problem:** "Fast" is subjective; no measurable target

**✅ Better:**
```
When a user submits an authentication request, the system shall respond 
within 500ms (p99 latency) during normal load (100 concurrent users).
```

---

### Anti-Pattern 6: Missing Context

**❌ Bad:**
```
The system shall return an error.
```
**Problem:** What error? When? What's the context?

**✅ Better:**
```
If a required field is missing from the request, the system shall return 
HTTP 400 Bad Request with a descriptive error message listing the missing fields.
```

---

## Writing Checklist

For each requirement, verify:

- [ ] **Specific:** Does it specify exactly what the system does? (not "be easy" but "enable signup in 3 clicks")
- [ ] **Measurable:** Can you test it? (not "fast" but "<500ms latency")
- [ ] **Context:** Does it include When/Where/While/If? (or is ubiquitous?)
- [ ] **Single Concern:** Does it address one thing? (not "auth, authz, and logging")
- [ ] **RFC 2119 Keyword:** Does it use SHALL/SHOULD/MAY correctly? (not "must" or "will")
- [ ] **Complete:** Does a developer understand what to implement?
- [ ] **Testable:** Can QA write a test to verify it?
- [ ] **Traceable:** Can you link this to a design component and task?

---

## Additional Resources

- **RFC 2119:** https://www.ietf.org/rfc/rfc2119.txt (Keyword definitions)
- **EARS Original Paper:** "Easy Approach to Requirements Syntax" by Alistair Mavin et al.
- **INCOSE:** International Council on Systems Engineering (INCOSE) standards on requirements
