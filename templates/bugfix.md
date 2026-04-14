<!-- markdownlint-disable -->
# Bugfix Spec: {{bug_title}}

> Structured specification for bug investigation and resolution.

---

## 1. Current Behavior

{{current_behavior}}

---

## 2. Expected Behavior

{{expected_behavior}}

---

## 3. Unchanged Behavior

The following behaviors must remain unchanged after the fix:

{{#each unchanged_behavior}}
- {{this}}
{{/each}}

---

## 4. Root Cause Analysis

{{root_cause}}

---

## 5. Test Plan

{{test_plan}}

---

## Metadata

- **Reported:** {{date}}
- **Severity:** {{severity}}
- **Related Requirements:** {{related_requirements}}
