# Getting Started with SDD Spec Engineer

**From zero to your first spec in 15 minutes**

---

## Prerequisites

Before you start, make sure you have **one** of the following:

- **GitHub Copilot** (any recent version with Chat support)
- **Claude Code** CLI (installed and authenticated)

If you don't have either installed yet, [install Claude Code here](https://claude.com/claude-code) or enable GitHub Copilot in your IDE.

---

## Step 1: Choose Your Platform (2 minutes)

SDD Spec Engineer works with two platforms. Pick one based on what you use daily.

### Path A: GitHub Copilot

If you use GitHub Copilot, copy the agents directory to your repository:

```bash
# From sdd-spec-engineer directory
cp -r agents/ /path/to/your/repo/.github/agents/
```

Then in Copilot Chat, invoke agents directly:

```
@spec-engineer build a REST API for a todo list app
```

**That's it.** Copilot will orchestrate the full pipeline and save output to `.specs/` in your repo.

### Path B: Claude Code

If you prefer Claude Code CLI, copy the commands:

```bash
# From sdd-spec-engineer directory
cp -r .claude/commands/ /path/to/your/project/.claude/commands/
cp CLAUDE.md /path/to/your/project/CLAUDE.md
```

Then in Claude Code, invoke commands:

```
/sdd:spec build a REST API for a todo list app
```

**Path B is recommended for first-time users** because error messages are clearer and you control each phase's LGTM checkpoint.

---

## Step 2: Run Your First Spec (5 minutes)

Let's walk through a concrete example: building a REST API for a todo list app.

### Start the specification phase

In Claude Code:

```
/sdd:spec Create a REST API for managing a personal todo list. Users can add, view, edit, and delete tasks. Tasks have a title, description, due date, and completion status.
```

### What happens next

SDD Spec Engineer asks you **clarifying questions** (Phase 0). Answer them concretely:

```
Question 1: What format should the API use—REST/HTTP or GraphQL?
Your answer: REST/HTTP with JSON payloads

Question 2: Should the API require authentication?
Your answer: Yes, JWT tokens. Each user sees only their own tasks.

Question 3: What persistence layer? Database, in-memory, file-based?
Your answer: PostgreSQL

Question 4: Any rate limits or pagination requirements?
Your answer: 100 tasks per page, 1000 requests per hour per user

Question 5: Should completed tasks be soft-deleted or hard-deleted?
Your answer: Soft-deleted (include deleted_at timestamp)
```

### First phase output: Constitution

After you answer, Claude generates a **CONSTITUTION.md** file. It looks like this:

```markdown
# Constitution: Todo List API

## 1. Principles
- Every task belongs to exactly one user
- Deletion is logical (soft-delete), never physical
- All timestamps are UTC
- All IDs are UUIDs (v4)

## 2. Decision Rules
- IF creating a task without a due date, THEN default to 30 days from now
- IF updating a completed task, THEN reject with 409 Conflict
- IF query has no pagination params, THEN return first 100 results

## 3. Naming Conventions
- Use snake_case for JSON keys (task_id, created_at)
- Use Title Case for HTTP status reasons (Created, Not Found)
- Prefix all internal errors with ERR_: ERR_AUTH_FAILED, ERR_INVALID_UUID

## 4. Non-Goals
- Real-time sync via WebSockets
- Recurring tasks
- Task dependencies or ordering
- Collaborative editing
```

**Review this**, make sure it matches your vision. Then reply:

```
LGTM - ready for specification phase
```

### Second phase: Specification (EARS notation)

Claude generates **SPECIFICATION.md** with acceptance criteria in [EARS notation](references/ears-notation.md):

```markdown
## Feature 1: Create a Task

**Requirement 1.1:** THE SYSTEM create-task API accepts a POST request with a JSON body containing task_title and optional task_description, task_due_date.

**Requirement 1.2:** THE SYSTEM validates that task_title is non-empty and at most 255 characters; IF validation fails, THE SYSTEM responds with HTTP 400 and an error message.

**Requirement 1.3:** GIVEN a valid request with a non-empty task_title, WHEN the user is authenticated with a valid JWT, THEN THE SYSTEM creates a new task record with:
- task_id: auto-generated UUID
- user_id: from JWT subject claim
- status: "pending"
- created_at: current UTC timestamp
- updated_at: current UTC timestamp

AND THE SYSTEM responds with HTTP 201 and the created task object.

**Requirement 1.4:** GIVEN a valid request, WHEN the user is NOT authenticated, THEN THE SYSTEM responds with HTTP 401 Unauthorized.

## Feature 2: List Tasks (with Pagination)

**Requirement 2.1:** THE SYSTEM GET /tasks API returns a paginated list of tasks for the authenticated user.

**Requirement 2.2:** GIVEN query parameters ?page=1&limit=50, WHEN limit > 100, THEN THE SYSTEM caps the limit to 100.

**Requirement 2.3:** THE SYSTEM includes pagination metadata in response:
{
  "tasks": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 247,
    "has_next": true
  }
}

## Feature 3: Complete a Task

**Requirement 3.1:** THE SYSTEM PATCH /tasks/{task_id} API with body { "status": "completed" } marks a task as done.

**Requirement 3.2:** GIVEN a task with status "completed", WHEN the user attempts to modify it again, THEN THE SYSTEM responds with HTTP 409 Conflict.

...
```

Each requirement is numbered (1.1, 1.2, 2.1, etc.) so it can be traced to design and tests later.

**Review this carefully.** Reply:

```
LGTM
```

### Third phase: Clarify (Ambiguity Resolution)

Claude asks up to **5 follow-up questions** to resolve any remaining ambiguity:

```
Q1: For Requirement 3.2, should users be able to UNDO task completion?
Q2: Should the API include a bulk delete endpoint (/tasks/batch-delete)?
Q3: What happens if a user tries to update another user's task?
Q4: Should task timestamps include microseconds or just seconds?
Q5: Should the API support task search (e.g., /tasks/search?q=urgent)?
```

Answer them directly. Then reply `LGTM` when satisfied.

### Fourth phase: Design

Claude generates **DESIGN.md** with system architecture:

```markdown
## System Architecture

### Components
1. **API Gateway** — Route HTTP requests, enforce authentication
2. **Task Service** — Business logic for CRUD operations
3. **Validation Layer** — Input validation and authorization checks
4. **Database Layer** — PostgreSQL with connection pooling
5. **Error Handler** — Consistent error response formatting

### Data Model
```sql
CREATE TABLE tasks (
  task_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  task_description TEXT,
  task_due_date TIMESTAMP,
  status VARCHAR(20) CHECK (status IN ('pending', 'completed')),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

### API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | /tasks | Create a new task | JWT |
| GET | /tasks | List user's tasks (paginated) | JWT |
| GET | /tasks/{task_id} | Get a single task | JWT |
| PATCH | /tasks/{task_id} | Update a task | JWT |
| DELETE | /tasks/{task_id} | Soft-delete a task | JWT |

### Error Responses
All errors follow this format:
```json
{
  "error": "ERR_INVALID_UUID",
  "message": "task_id must be a valid UUID",
  "status": 400
}
```

### Sequence Diagram: Create Task
[Mermaid diagram showing API gateway → Task Service → Database]
```

Reply `LGTM` when ready to proceed.

### Fifth phase: Tasks

Claude breaks the design into **implementation tasks**:

```markdown
## Task 1: Set up PostgreSQL schema
- [ ] Run migration: create tasks table with indexes
- [ ] Verify foreign key constraint on user_id
- Acceptance Criteria: Database is ready, schema matches DESIGN.md

## Task 2: Implement Task Service (business logic)
- [ ] Write TaskService class with create(), list(), update(), delete() methods
- [ ] Implement pagination logic with offset/limit
- [ ] Add soft-delete support (set deleted_at, don't return in queries)
- Acceptance Criteria: All CRUD methods tested, cover Req 1.1-1.4, 2.1-2.3, 3.1-3.2

## Task 3: [P] Implement API endpoints (POST, GET, PATCH, DELETE)
- [ ] Route POST /tasks → create task
- [ ] Route GET /tasks → list tasks with pagination
- [ ] Route PATCH /tasks/{task_id} → update task
- [ ] Route DELETE /tasks/{task_id} → soft-delete
- Acceptance Criteria: All endpoints return correct status codes, match DESIGN.md

## Task 4: [P] Implement authentication middleware
- [ ] Extract JWT from Authorization header
- [ ] Validate JWT signature
- [ ] Attach user_id to request context
- Acceptance Criteria: Unauthenticated requests return 401, valid JWTs pass through

## Task 5: Implement error handling
- [ ] Catch validation errors → HTTP 400
- [ ] Catch not-found errors → HTTP 404
- [ ] Catch conflict errors (completed task update) → HTTP 409
- [ ] Standardize all error responses to match error format
- Acceptance Criteria: All error cases tested, responses match DESIGN.md

## Task 6: Integration tests
- [ ] Test full flow: create task → list → update → delete
- [ ] Test pagination (page=1, limit=50, etc.)
- [ ] Test authorization (user A cannot see user B's tasks)
- [ ] Test soft-delete (deleted tasks don't appear in list, but data isn't lost)
- Acceptance Criteria: 100% acceptance criteria from SPECIFICATION.md covered by tests
```

The `[P]` marker means tasks can run in parallel (e.g., endpoints and auth can be done simultaneously).

Reply `LGTM` to finish the pipeline.

---

## Step 3: Understand the Output (3 minutes)

After LGTM on all phases, your project now has a complete spec directory:

```
.specs/001-todo-api/
├── CONSTITUTION.md      # Principles, decision rules, naming
├── SPECIFICATION.md     # EARS requirements (numbered)
├── DESIGN.md            # Architecture, data model, endpoints
├── TASKS.md             # Task breakdown, [P] markers, acceptance criteria
└── ANALYSIS.md          # Traceability matrix, quality report
```

### What each file is for

| File | When to read | What it contains |
|------|--------------|-----------------|
| **CONSTITUTION.md** | Before design starts | Team's shared principles and decision rules |
| **SPECIFICATION.md** | Before implementation | What the system must do (acceptance criteria) |
| **DESIGN.md** | When starting implementation | How the system is organized (components, APIs, database schema) |
| **TASKS.md** | When assigning work | Who does what, in what order, with [P] parallelization hints |
| **ANALYSIS.md** | Before release | Traceability: does every requirement have a task and test? |

**Golden rule:** If you're confused about *why* something is implemented a certain way, check DESIGN.md. If you're confused about *what* needs to be done, check SPECIFICATION.md.

---

## Step 4: Use the Quality Gate (2 minutes)

Before you ship, run the analyze command to verify completeness:

```
/sdd:analyze
```

Claude generates **ANALYSIS.md** with a **traceability matrix**:

```markdown
## Traceability Matrix

| Requirement | Design Component | Task | Test Case | Status |
|-------------|------------------|------|-----------|--------|
| 1.1: Create POST endpoint | API Gateway | Task 3 | test_create_task_success | ✓ |
| 1.2: Validate title length | Validation Layer | Task 2 | test_create_task_invalid_title | ✓ |
| 1.3: Create task with UUID | Task Service | Task 2 | test_create_task_has_uuid | ✓ |
| 1.4: Require authentication | Auth Middleware | Task 4 | test_create_task_no_auth | ✓ |
| 2.1: List with pagination | API Gateway | Task 3 | test_list_tasks_paginated | ✓ |
| 2.2: Cap limit to 100 | Task Service | Task 2 | test_pagination_max_limit | ✓ |
| 2.3: Return pagination metadata | API Gateway | Task 3 | test_pagination_metadata | ✓ |
| 3.1: PATCH /tasks/{id} | API Gateway | Task 3 | test_update_task_status | ✓ |
| 3.2: Reject update on completed | Task Service | Task 2 | test_update_completed_task_conflict | ✓ |
```

If a requirement has **no corresponding task**, it shows `❌ ORPHANED`. That's a signal to add a task or refine the requirement.

### Example gap

If you see:

```
| 2.4: Search tasks | Design Component MISSING | Task MISSING | Test MISSING | ❌ MISSING
```

You have three options:
1. **Add the missing work** — Update DESIGN.md and TASKS.md to include search
2. **Remove the requirement** — Delete it from SPECIFICATION.md if it's out of scope
3. **Adjust the decision rule** — Maybe search is a future feature (add to Constitution's Non-Goals)

Then reply `LGTM` or `Request Changes`. If there are gaps, Claude will ask you to fix them before proceeding.

---

## Step 5: Hand Off to Implementation (3 minutes)

Once ANALYSIS.md is clean, you have **4 ways to start implementation:**

### Option 1: Agent Mode (use AI to code)

```
/sdd:handoff agent
```

Claude copies each task to your AI agent (Copilot or Claude Code) one at a time. The agent codes it directly.

### Option 2: GitHub Issues (distribute work to team)

```
/sdd:handoff github-issues
```

Claude auto-creates GitHub issues from TASKS.md:

```
Title: Set up PostgreSQL schema
Body:
- [ ] Run migration: create tasks table with indexes
- [ ] Verify foreign key constraint on user_id

Acceptance Criteria:
- Database is ready
- Schema matches DESIGN.md specification

Linked to: Requirement 1.1, 1.2, 1.3
```

Assign issues to team members and track in your project board.

### Option 3: Manual (read and implement yourself)

Open TASKS.md and DESIGN.md in your editor, start coding. Many developers prefer this because they can choose when to ask AI for help.

### Option 4: Terminal (run scripts directly)

Some teams have automation scripts that consume TASKS.md and deploy directly. If you have this set up, use it.

---

## Common Workflows

Here's a quick reference for common scenarios after your first spec:

### Scenario: "I have a new feature idea"

```
/sdd:spec [describe the feature]
```

→ Runs the full 7-phase pipeline as you did above.

### Scenario: "I found a bug in production"

```
/sdd:bugfix
```

→ Traces the bug to a failing acceptance criterion in SPECIFICATION.md.
→ Shows which task should have caught it.
→ Generates a test that reproduces the bug.

### Scenario: "I want to add design to an existing spec"

If you previously created a spec but skipped the design phase:

```
/sdd:design
```

→ Reads SPECIFICATION.md and generates DESIGN.md.

### Scenario: "I've implemented some features and the spec is out of sync"

```
/sdd:analyze
```

→ Compares code to SPECIFICATION.md.
→ Generates SYNC_REPORT.md showing what drifted.
→ Suggests whether to update spec, revert code, or accept the change.

### Scenario: "I want to audit the spec quality"

```
/sdd:analyze
```

→ Builds traceability matrix.
→ Flags orphaned requirements.
→ Checks for ambiguity in EARS statements.

---

## Tips for Success

### Always provide LGTM between phases

After each phase (Constitution → Spec → Clarify → Design → Tasks → Analyze), Claude pauses and waits for your approval. This ensures quality and lets you steer the spec if it goes off track.

**Good:** Review the output, reply `LGTM` or explain what to change.

**Avoid:** Assume Claude should continue automatically (it won't).

### Use Design-First for UI/frontend, Requirements-First for APIs/backend

- **Design-First:** Start with mocks, wireframes, user flows. Then write SPECIFICATION.md to match the design.
- **Requirements-First:** Start with acceptance criteria (SPECIFICATION.md). Then create DESIGN.md to satisfy them.

Pick the style that matches your team's workflow.

### Keep specs updated as code changes

After implementation, run `/sdd:analyze` to check if code matches spec. If the implementation drifted (intentionally or not), update the spec. This prevents future confusion.

### Start with small features before speccing large systems

Your first spec might be a single API endpoint (like we did with todo-api). After 1-2 small specs, you'll internalize the process. Then tackle larger features.

### Use EARS notation consistently

Every requirement starts with **THE SYSTEM**, **GIVEN**, or **WHEN**. This forces clarity. If you can't write a requirement in EARS, it's probably too vague.

---

## Troubleshooting

### "Agent doesn't start"

**Cause:** File paths are wrong.

**Fix:** Verify that:
- For Copilot: `agents/` is in `.github/agents/`
- For Claude Code: `.claude/commands/` is in your project root, and you have a `CLAUDE.md`

```bash
# Verify Copilot setup
ls -la .github/agents/

# Verify Claude Code setup
ls -la .claude/commands/
cat CLAUDE.md
```

### "Output is too complex / too long"

**Cause:** You described a feature that's too big for one spec.

**Fix:** Break it into smaller features. Instead of:

```
/sdd:spec Build a full e-commerce platform
```

Try:

```
/sdd:spec Create a product catalog API with search and filtering
```

Then create separate specs for checkout, payments, shipping, etc.

### "EARS notation is confusing"

**Fix:** Read `references/ears-notation.md`. It has 20+ real examples. Read 3-4 examples before writing your first requirement.

### "Phases seem redundant"

**Why they're not:**

| Phase | Answers | Output |
|-------|---------|--------|
| Constitution | **WHO agrees on what?** | Team's principles |
| Specification | **WHAT must the system do?** | Acceptance criteria |
| Clarify | **WHAT is ambiguous?** | Resolved questions |
| Design | **HOW is it organized?** | Components, APIs, data model |
| Tasks | **WHO does WHAT in what order?** | Task breakdown |
| Analyze | **Is everything traceable?** | Quality report |

Each phase answers a different question with different stakeholders.

---

## Next Steps

You've now completed your first spec. Here's where to go next:

1. **Deepen your EARS skills:** Read [`references/ears-notation.md`](references/ears-notation.md) for advanced patterns like exceptions and performance criteria.

2. **Customize templates:** Check [`references/spec-templates.md`](references/spec-templates.md) for boilerplate you can reuse (user flows, API specs, data models).

3. **Learn design patterns:** Read [`references/design-patterns.md`](references/design-patterns.md) for architecture patterns you can reference in the Design phase.

4. **Explore hooks:** See `hooks/` directory to set up automation (auto-test generation, auto-docs, security scanning, spec-sync checking).

5. **Understand the system:** Read [`ARCHITECTURE.md`](ARCHITECTURE.md) to see how all 7 phases fit together.

6. **Full feature list:** Check [`README.md`](README.md) for all commands and integrations.

---

## You're ready

That's it. You now know enough to spec a feature end-to-end. The first one takes 15 minutes. The second takes 10. By the fifth, you'll be speccing in your sleep.

**Go write your first spec. Reply LGTM when you're ready.**
