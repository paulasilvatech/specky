---
title: "todo-api — Specification"
feature_id: "001-todo-api"
version: "1.0.0"
date: "2026-07-01"
author: "SDD Pipeline"
status: "Draft"
---
<!-- markdownlint-disable -->
# todo-api — Specification

> All requirements use **EARS notation** (Easy Approach to Requirements Syntax). Each requirement is testable, unambiguous, and traceable to the Constitution's success criteria.

---

## Table of Contents

- [1. Core Requirements](#1-core-requirements)
- [2. Functional Requirements](#2-functional-requirements)
- [3. Non-Functional Requirements](#3-non-functional-requirements)
- [Acceptance Criteria Summary](#acceptance-criteria-summary)

---

## 1. Core Requirements

### REQ-TODO-001: (ubiquitous)

The system shall expose a REST API for creating, reading, updating, and deleting to-do items.

**Acceptance Criteria:**
- POST /todos returns 201 with id
- GET /todos lists items
- PUT /todos/:id updates
- DELETE /todos/:id returns 204

---

### REQ-TODO-002: (event_driven)

When a client creates a to-do item, the system shall assign a unique identifier and persist the item within 100ms.

**Acceptance Criteria:**
- Unique id per item
- p95 create latency under 100ms
- Survives restart

---

### REQ-TODO-003: (event_driven)

When a client toggles completion on a to-do item, the system shall persist the new state and return the updated item.

**Acceptance Criteria:**
- PATCH /todos/:id/toggle flips completed
- Response has updated completed

---

### REQ-TODO-004: (unwanted)

If a client submits a to-do item with an empty or missing title, then the system shall reject the request with a 400 status and a descriptive error.

**Acceptance Criteria:**
- Empty title returns 400
- Error names the field

---


---

## 2. Functional Requirements



---

## 3. Non-Functional Requirements



---

## Acceptance Criteria Summary

| ID | Requirement | Test Method |
|----|-------------|-------------|
| REQ-TODO-001 | The system shall expose a REST API for creating, reading, up... | Acceptance test |
| REQ-TODO-002 | When a client creates a to-do item, the system shall assign ... | Acceptance test |
| REQ-TODO-003 | When a client toggles completion on a to-do item, the system... | Acceptance test |
| REQ-TODO-004 | If a client submits a to-do item with an empty or missing ti... | Acceptance test |

---

## Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| EARS notation compliance | 4/4 | |
| Testability | 4/4 | Every requirement has acceptance criteria |
| Traceability | 4/4 | Every requirement traces to Constitution |
| Uniqueness of IDs | 4/4 | No duplicate requirement IDs |
