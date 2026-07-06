---
description: Run the full SDD pipeline end-to-end
agent: agent
argument-hint: <feature description or number>
---
Run the full SDD pipeline for feature [FEATURE NUMBER or NAME].

@specky-orchestrator — coordinate all 10 phases (Init → Discover → Specify → Clarify → Design → Tasks → Analyze → Implement → Verify → Release), validate artifacts between phases, enforce LGTM gates at Phases 2/4/5, and route to the correct agent per phase.
