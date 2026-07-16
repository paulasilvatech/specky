---
description: Start a greenfield project with SDD pipeline
agent: agent
argument-hint: <project idea>
---
Start a greenfield project with the Specky SDD pipeline.

**Project:** [PROJECT NAME]
**Feature number:** [NNN — explicit, three digits]
**Workload:** [api | web-application | service | cli | library | infrastructure]
**Execution mode:** [full | rapid | emergency]
**Description:** [What the system will do in 1-2 sentences]
**Capabilities:** [explicit list, or none]
**Capability parameters:** [complete configuration for every enabled capability]

Please:
1. Call @specky-requirements-engineer to extract FRD and NFRD
2. Then @specky-sdd-init to initialize the pipeline and create CONSTITUTION.md
3. Initialize exactly the selected feature and show its contract fingerprint and signed state path
4. Do not create a branch unless release capability is enabled and the feature reaches an allowed branch phase
