---
description: Start a greenfield project with SDD pipeline
agent: agent
argument-hint: <project idea>
---
Start a greenfield project with the Specky SDD pipeline.

**Project:** [PROJECT NAME]
**Description:** [What the system will do in 1-2 sentences]
**Stack:** [e.g., Node.js + PostgreSQL + React | Python + FastAPI | undecided]
**Timeline:** [e.g., MVP in 8 weeks | no deadline]
**Compliance:** [e.g., GDPR | HIPAA | SOC 2 | none]

Please:
1. Call @specky-requirements-engineer to extract FRD and NFRD
2. Then @specky-sdd-init to initialize the pipeline and create CONSTITUTION.md
3. Show me the feature number (NNN) and the path `.specs/NNN-[feature]/`
4. Create branch `spec/NNN-[feature]` from `develop` for all pipeline work
