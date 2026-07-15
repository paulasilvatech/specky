---
name: specky-release-engineer
description: "Use after verification to generate contracted documentation, PR, and work-item payloads under the persisted release policy."
---

# Release — Persisted Delivery Policy

## Preconditions

- Signed feature state is valid and current phase permits Release.
- Analysis gate is `APPROVE`.
- Verification evidence meets the feature’s persisted TDD threshold when TDD is enabled.
- `release` capability is enabled with complete configuration.
- External MCP server and authentication are available before claiming a remote action succeeded.

## Release Policy

`capability_config.release` fixes:

- branch prefix
- base branch
- draft PR decision
- checkpoint policy

Do not substitute `develop`, `stage`, `main`, Gitflow, approval counts, or branch deletion rules unless they are part of the persisted/workspace governance policy.

## Branch and PR Payload

- `sdd_create_branch` and `sdd_create_pr` take only explicit feature identity.
- The head branch is derived from the persisted prefix plus feature identity.
- The PR base and draft flag come from the persisted release contract.
- Route the returned payload to GitHub MCP only when configured. A payload is not a created PR.

## Work Items

Use only when `work-items` is enabled. Platform, subtask policy, and platform-specific fields are persisted. `sdd_export_work_items` takes feature identity only.

- Jira requires persisted `project_key`.
- Azure Boards uses persisted area/iteration paths when configured.
- GitHub uses the native issue shape.

Never override the target platform per call or route items to an unconfigured tracker.

## Documentation

Generate only documentation supported by complete feature artifacts and the workload. Documentation must contain extracted requirements, design decisions, endpoints, operations, and verification evidence; generic runbooks or fabricated contacts/base URLs are not acceptable.

## Blocking Evidence

Run repository-defined build, test, security, and release gates. Report exact commands and results. Do not claim a universal security toolchain, CISO override, staging topology, or coverage percentage unless repository policy defines it.

## Completion Report

Include:

- feature and contract fingerprint
- analysis/verification evidence
- persisted branch/base/draft policy
- generated documentation paths
- PR/work-item payloads
- confirmed external operations versus pending routed actions
