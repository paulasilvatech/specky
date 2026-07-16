---
description: Add SDD pipeline to an existing codebase
agent: agent
argument-hint: <feature to add>
---
Add the Specky SDD pipeline to this existing codebase.

**Feature:** [FEATURE NAME]
**Feature number:** [NNN — explicit, three digits]
**Workload:** [api | web-application | service | cli | library | infrastructure]
**Execution mode:** [full | rapid | emergency]
**What to modernize:** [Component, module, or area to target]
**Capabilities and parameters:** [explicit]

Please:
1. Run `sdd_scan_codebase` with explicit depth and exclusion patterns
2. Call @specky-sdd-init with lifecycle `brownfield`, selected workload/mode, explicit number, and exact capability configuration
3. Pass the codebase summary into brownfield discovery and capture compatibility/rollback evidence
4. Do not create a branch unless the persisted release policy enables it in the current phase
