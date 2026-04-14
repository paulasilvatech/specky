<!-- markdownlint-disable -->
# {{project_name}} — Design

> Complete system design covering architecture, data, APIs, security, infrastructure, and decisions.

---

## 1. System Context (C4 Level 1)

> Who uses the system and what external systems does it integrate with?

{{system_context}}

---

## 2. Container Architecture (C4 Level 2)

> What are the deployable units (APIs, databases, queues, frontends) and how do they communicate?

{{container_architecture}}

---

## 3. Component Design (C4 Level 3)

> What are the internal modules/services within each container and their responsibilities?

{{component_design}}

---

## 4. Code-Level Design (C4 Level 4)

> Key classes, interfaces, patterns, and their relationships.

{{code_level_design}}

---

## 5. System Diagrams

{{#each diagrams}}
### {{this}}
{{/each}}

---

## 6. Data Model

> Entities, relationships, storage strategy, and data flow.

{{data_models}}

---

## 7. API Contracts

> Endpoints, request/response schemas, authentication, and error codes.

{{api_contracts}}

---

## 8. Infrastructure & Deployment

> How the system is deployed, scaled, monitored, and operated.

{{infrastructure}}

---

## 9. Security Architecture

> Authentication, authorization, encryption, secrets management, and threat model.

{{security_architecture}}

---

## 10. Architecture Decision Records

{{#each adrs}}
### {{this}}
{{/each}}

---

## 11. Error Handling Strategy

> How errors are detected, logged, propagated, and recovered from.

{{error_handling}}

---

## 12. Cross-Cutting Concerns

> Logging, monitoring, caching, configuration, feature flags, and observability.

{{cross_cutting}}

---

**Covers:** {{requirement_references}}
