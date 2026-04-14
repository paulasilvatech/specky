---
title: "Specky SDD — Competitive Brief & Comparison Table Improvement Plan"
description: "Competitive analysis of the SDD tools landscape with actionable recommendations to strengthen Specky's comparison table at getspecky.ai"
author: "Paula Silva"
date: "2026-04-14"
version: "1.0.0"
status: "review"
tags: ["competitive-analysis", "specky", "sdd", "positioning"]
---

# Specky SDD — Competitive Brief

## Table of Contents

1. Executive Summary
2. Competitive Landscape Map
3. Competitor Profiles
4. Current Table Analysis — What's Wrong
5. Recommended Improved Comparison Table
6. Messaging & Positioning Recommendations
7. Battlecard for Sales/Community
8. Action Items

---

## 1. Executive Summary

Specky now occupies a unique position in the SDD landscape: it is the **only open-source, MCP-native, multi-IDE plugin** that combines EARS notation, enforced pipeline phases, compliance frameworks, and automated hooks in a single install. The current comparison table on getspecky.ai compares against vague categories ("Cloud SDD Tools" and "Cursor/Windsurf/Kiro") rather than named competitors, which weakens credibility. The competitive landscape has evolved significantly — Kiro now has EARS notation and hooks too, GitHub Spec Kit is free and open-source, and Intent offers living specs. The table needs to be restructured to name specific competitors, highlight Specky's genuine differentiators, and correct areas where Specky is no longer uniquely ahead.

**Biggest opportunity:** Specky is the only tool that is simultaneously open-source, works across ALL MCP-compatible IDEs, has 57 MCP tools, AND supports 6 compliance frameworks. No competitor combines all four.

**Biggest threat:** Kiro now has EARS notation, hooks, and AWS backing. The current table claims Kiro has "No" EARS notation — this is factually wrong and undermines trust.

---

## 2. Competitive Landscape Map

The SDD tools market in 2026 has six serious competitors across two categories:

### Living-Spec Platforms (spec updates as code changes)
- **Intent** ($60–$200/mo) — Bidirectional spec sync, 400K+ file context engine, multi-agent

### Static-Spec Platforms (spec-first, manual reconciliation)
- **Kiro** (AWS, $20/mo) — EARS notation, 3-document system, agent hooks, AWS-native
- **GitHub Spec Kit** (free, MIT) — Cross-agent CLI, markdown specs, quality assurance commands
- **OpenSpec** (free, open-source) — Delta markers, approval gates, 20+ agent support
- **BMAD-METHOD** (free, open-source) — 21+ specialized agents, enterprise SDLC flows

### AI IDEs with Partial Spec Features
- **Cursor** ($20/mo) — .cursorrules convention enforcement, no formal SDD
- **Windsurf** ($15–$60/mo) — Workflow automation, no formal SDD

---

## 3. Competitor Profiles

### Kiro (AWS) — The Primary Threat

**What they do:** AWS's agentic IDE that implements spec-driven development using EARS notation, generating requirements.md, design.md, and tasks.md from natural language prompts.

**Pricing:** Free tier (50 credits/month), Pro $20/mo (1,000 credits), Pro+ $39/mo (3,000 credits)

**Strengths:**
- EARS notation support (same as Specky — your table says they don't have it, but they DO)
- Agent hooks that fire on file save/create/delete events
- AWS Bedrock integration for enterprise AI
- Requirements-first AND design-first workflows
- Free tier for onboarding
- AWS brand credibility

**Weaknesses:**
- Specs are STATIC — they don't update as implementation evolves (Specky has drift-monitor hook)
- Single agent only (no multi-agent orchestration like Specky's 13 agents)
- Claude models only (no model flexibility)
- No MCP tools (proprietary integration)
- No compliance frameworks
- No offline/air-gapped support
- Proprietary, vendor-locked to AWS ecosystem
- Reliability issues during peak demand reported
- 3-document system only (requirements, design, tasks) vs. Specky's full pipeline

**Key differentiator vs. Specky:** Kiro is an entire IDE; Specky is a plugin that works in ANY IDE. Specky has 13 agents orchestrating 10 phases; Kiro has 1 agent with hooks.

---

### GitHub Spec Kit — The Open-Source Competitor

**What they do:** GitHub's official SDD CLI that creates workspace setups for multiple coding assistants. Agent-agnostic by design.

**Pricing:** Free, MIT license

**Strengths:**
- Cross-agent compatibility (Copilot, Claude Code, Gemini CLI, Cursor, Windsurf)
- GitHub official backing
- Quality assurance commands (/speckit.clarify, /speckit.analyze)
- Version-controllable specs
- Free and open-source

**Weaknesses:**
- Static specs (drift over time)
- No EARS notation
- No hooks or automation
- No compliance frameworks
- No MCP tools
- 1–2 hour overhead per spec generation cycle
- Struggles with legacy/brownfield codebases
- Single-repo focus only
- No agent orchestration

**Key differentiator vs. Specky:** Spec Kit is a CLI that generates static markdown; Specky is a full plugin with 13 agents, 57 MCP tools, 14 hooks, and 6 compliance frameworks.

---

### Intent — The Premium Alternative

**What they do:** Living-spec platform with bidirectional sync between docs and code. Coordinator + specialist agents with 400K+ file semantic understanding.

**Pricing:** $60/month (Standard, 20 users), $200/month (Max)

**Strengths:**
- ONLY tool with truly living specs (bidirectional sync)
- 400K+ file context engine
- Multi-agent architecture (Investigate, Implement, Verify, Critique, Debug, Code Review)
- Isolated git worktrees via "Spaces"

**Weaknesses:**
- Expensive ($60–$200/mo vs. Specky free)
- No EARS notation
- No compliance frameworks
- No offline/air-gapped support
- Proprietary, closed-source
- Limited third-party benchmarks
- Third-party agents lose Context Engine capabilities

**Key differentiator vs. Specky:** Intent has living specs; Specky has static specs with drift-monitoring hooks as a mitigation. But Intent costs $60+/mo and lacks EARS, compliance, and offline support.

---

### Cursor — The Mainstream IDE

**What they do:** AI-native code editor with autocomplete, multi-agent workflows, and background agents. No formal SDD.

**Pricing:** Free (limited), Pro $20/mo, Business $40/mo

**Strengths:**
- Best-in-class autocomplete (Supermaven)
- Background Agents (parallel autonomous tasks)
- BugBot automated bug detection
- Multi-model support (OpenAI, Anthropic, Gemini, xAI)
- Cursor 3 "Agents Window" for managing multiple agents
- Massive user base

**Weaknesses:**
- No spec-driven development at all
- .cursorrules are convention enforcement, not specs
- No EARS notation, no traceability, no compliance
- VS Code only (no other IDE)
- No MCP tools
- Proprietary

**Key differentiator vs. Specky:** Cursor is a coding IDE; Specky adds SDD discipline to ANY IDE. They're complementary — Specky works inside Cursor via MCP.

---

### Windsurf (Cognition AI) — The AI IDE

**What they do:** AI-powered IDE with Cascade agentic AI. Claims AI writes ~94% of code in typical workflows.

**Pricing:** Free tier, Pro $15/mo, Teams $35/mo, Enterprise $60/mo

**Strengths:**
- Cascade AI agent with deep codebase understanding
- Arena Mode for model comparison
- SWE-1.5 model
- Good onboarding experience

**Weaknesses:**
- No spec-driven development
- No EARS notation, no traceability
- No compliance frameworks
- No hooks or automation for spec workflow
- Proprietary
- Now owned by Cognition AI (Devin) — strategic direction uncertain

**Key differentiator vs. Specky:** Windsurf is a coding IDE; Specky adds SDD discipline. Specky works inside Windsurf via MCP.

---

## 4. Current Table Analysis — What's Wrong

After analyzing the comparison table at getspecky.ai against real competitor data:

### Factual Errors (MUST FIX)

1. **"EARS notation requirements — Cursor/Windsurf/Kiro: ✗ No"** — WRONG. Kiro uses EARS notation explicitly. Their requirements.md uses the "WHEN [condition] THE SYSTEM SHALL [behavior]" pattern. This undermines credibility.

2. **"Spec-sync hooks — Cursor/Windsurf/Kiro: ✗ No"** — PARTIALLY WRONG. Kiro has agent hooks that fire on file save, create, and delete events. Not as comprehensive as Specky's 14, but claiming "No" is inaccurate.

3. **"Enforced pipeline — Cursor/Windsurf/Kiro: ~ Kiro only"** — VAGUE. Should specify what Kiro's pipeline actually is (3-phase: requirements → design → tasks) vs. Specky's 10 phases.

### Structural Problems

4. **"Cloud SDD Tools" is too vague** — Name the competitors. "Cloud SDD Tools" could mean anything. Use Intent, GitHub Spec Kit, or specific tools.

5. **"Cursor/Windsurf/Kiro" lumped together** — These three are fundamentally different products. Cursor and Windsurf have ZERO SDD features. Kiro is a full SDD tool. Grouping them unfairly weakens the comparison.

6. **Missing key competitors** — GitHub Spec Kit (free, MIT, official GitHub) and OpenSpec (free, open-source) are not mentioned. These are Specky's real open-source competitors.

7. **"14 hooks" in table but website hero says "14 hooks"** — Consistent, but the plugin we built has 10. Verify the correct count.

### Missing Differentiators

8. **Number of agents** — Specky has 13 agents. Kiro has 1. Intent has ~6. BMAD has 21+. This is a major differentiator not shown.

9. **Number of pipeline phases** — Specky has 10. Kiro has 3. This gap should be prominent.

10. **Cross-IDE portability** — Specky works in Copilot, Claude Code, Cursor, Windsurf, and any MCP host. Kiro is its own IDE. This is a killer differentiator.

11. **Pricing detail** — Kiro is $20/mo, Intent is $60/mo, Cursor is $20/mo. Specky is free. The table says "$$$" which hides how favorable the comparison actually is.

---

## 5. Recommended Improved Comparison Table

### Option A: 4-Column Named Competitors

Replace the current table with named competitors in separate columns:

```
FEATURE                              | SPECKY          | KIRO (AWS)       | GITHUB SPEC KIT  | INTENT
─────────────────────────────────────┼─────────────────┼──────────────────┼───────────────────┼──────────

DEPLOYMENT & PRIVACY
Runs 100% locally                    | ✓ Yes           | ✗ Cloud required | ✓ Yes             | ✗ Cloud required
Air-gapped / offline                 | ✓ Full          | ✗ No             | ✓ Yes             | ✗ No
Open source (MIT)                    | ✓ MIT           | ✗ Proprietary    | ✓ MIT             | ✗ Proprietary
No signup required                   | ✓ Yes           | ✗ AWS account    | ✓ Yes             | ✗ Account needed
Price                                | ✓ Free          | $20–39/mo        | ✓ Free            | $60–200/mo

SPEC-DRIVEN WORKFLOW
Pipeline phases                      | ✓ 10 phases     | 3 phases         | ✗ No pipeline     | ✗ No pipeline
EARS notation                        | ✓ 6 patterns    | ✓ Basic EARS     | ✗ No              | ✗ No
Traceability matrix                  | ✓ Automated     | ~ Per-task only  | ✗ Manual          | ✓ Living sync
Spec-sync hooks                      | ✓ 14 hooks      | ~ 3 event types  | ✗ No              | ✗ No
Spec lifecycle                       | ✓ Living drift  | ✗ Static         | ✗ Static          | ✓ Living bidirectional

AGENTS & ORCHESTRATION
Specialized agents                   | ✓ 13 agents     | 1 agent          | ✗ None            | ~ 6 agents
MCP tools                            | ✓ 57 tools      | ✗ No MCP         | ✗ No MCP          | ✓ MCP support
Prompts / commands                   | ✓ 22 prompts    | ~ Chat-based     | ~ 5 commands      | ~ Chat-based
Model flexibility                    | ✓ Any model     | ✗ Claude only    | ✓ Any agent       | ~ Limited

COMPLIANCE & SECURITY
Compliance frameworks                | ✓ 6 frameworks  | ✗ No             | ✗ No              | ✗ No
OWASP Top 10 pipeline scan          | ✓ Phase 8       | ✗ No             | ✗ No              | ✗ No
RBAC + audit log                     | ✓ v3.2.2        | ✗ No             | ✗ No              | ✗ No

IDE SUPPORT
Works in GitHub Copilot              | ✓ Full plugin   | ✗ Own IDE only   | ✓ Via commands    | ✗ No
Works in Claude Code                 | ✓ Full plugin   | ✗ Own IDE only   | ✓ Via commands    | ✓ Via agent
Works in Cursor / Windsurf           | ✓ Via MCP       | ✗ Own IDE only   | ✓ Via commands    | ✗ No
Works in any MCP host                | ✓ Universal     | ✗ No             | ✗ No              | ✓ Limited
```

### Option B: Keep 3 Columns but Rename and Fix

If you want to keep the simpler 3-column layout, rename the categories and fix the data:

```
FEATURE                              | SPECKY          | KIRO (AWS)       | OTHER SDD TOOLS
─────────────────────────────────────┼─────────────────┼──────────────────┼──────────────────

(Kiro gets its own column since it's the only real SDD competitor)
(Other SDD Tools = Spec Kit, OpenSpec, BMAD, Intent)
```

**My recommendation: Option A.** Naming competitors builds credibility and lets developers make informed decisions. The vague "Cloud SDD Tools" column looks like you're hiding the comparison.

---

## 6. Messaging & Positioning Recommendations

### Current Positioning (from site)
> "Stop vibe coding. Start spec coding."

This is strong — keep it. But the subheading tries to list too many numbers. Simplify.

### Recommended Headline Hierarchy

**H1:** "Stop vibe coding. Start spec coding." (keep)

**H2 (revised):** "The only open-source SDD plugin that works in every IDE. 13 agents, 57 MCP tools, 10 enforced phases, 6 compliance frameworks. Free forever."

### Narrative Arc to Strengthen

**Villain:** Vibe coding — shipping code without specs leads to drift, untestable requirements, compliance failures, and technical debt.

**Hero:** The developer/team that wants discipline without vendor lock-in.

**Transformation:** From "I think it works" → "Every requirement is traceable, tested, and compliant."

**Stakes:** "Kiro gives you EARS notation inside their proprietary IDE. We give you EARS notation inside YOUR IDE — Copilot, Claude Code, Cursor, Windsurf, or anything else that speaks MCP."

### Key Messaging Angles

1. **"Kiro locks you in. Specky sets you free."** — Kiro requires using their IDE and AWS account. Specky works everywhere.

2. **"13 agents vs. 1."** — Specky has specialized agents per pipeline phase. Kiro has a single general agent.

3. **"10 phases vs. 3."** — Specky's pipeline covers Discovery through Release Gate. Kiro stops at tasks.

4. **"Free vs. $20+/mo."** — MIT license, no signup, no credits, no limits.

5. **"Works offline. Works air-gapped. Works everywhere."** — Enterprise environments with security restrictions can use Specky. Kiro requires cloud connectivity.

---

## 7. Battlecard: Specky vs. Kiro

### Quick Overview
| | Specky | Kiro |
|--|--------|------|
| Type | Plugin (works in any IDE) | Standalone IDE |
| Price | Free (MIT) | $20–39/mo |
| EARS | 6 patterns, validated | Basic EARS |
| Agents | 13 specialized | 1 general |
| Pipeline | 10 phases | 3 phases |
| Hooks | 14 (2 blocking) | 3 event types |
| MCP Tools | 57 | 0 |
| Compliance | 6 frameworks | 0 |
| Offline | Full | No |
| IDE Lock-in | None | Yes (Kiro IDE) |

### If Someone Says "Kiro has EARS too"
**Response:** "Kiro uses basic EARS in requirements.md, yes. Specky validates EARS compliance with automated hooks, supports all 6 EARS patterns with reference documentation, and traces every EARS requirement through 10 pipeline phases to code and tests. Kiro stops at 3 phases — requirements, design, tasks. There's no verify, no compliance scan, no release gate."

### If Someone Says "Kiro is backed by AWS"
**Response:** "AWS backing means AWS lock-in. Kiro only runs Claude models through Bedrock. Specky is MIT-licensed, works with any model, in any IDE, and runs fully offline. You own the tool, not rent it."

### If Someone Says "Intent has living specs"
**Response:** "Intent is the only tool with true bidirectional spec sync — that's impressive. But it costs $60–200/month, has no EARS notation, no compliance frameworks, and no offline support. Specky is free, has EARS, has 6 compliance frameworks, and monitors drift with automated hooks. For most teams, hook-based drift detection at $0 beats living specs at $60."

### Landmine Questions to Ask
- "How many pipeline phases does your current SDD tool enforce?" (Kiro = 3, Specky = 10)
- "Can your SDD tool run in an air-gapped environment?" (Only Specky)
- "How many compliance frameworks does it validate against?" (Only Specky has any)
- "What happens if you want to switch IDEs next year?" (Kiro = start over, Specky = just install the plugin)

---

## 8. Action Items

### Quick Wins (This Week)

1. **Fix the EARS notation row** — Change Kiro from "✗ No" to "✓ Basic EARS" to maintain credibility
2. **Fix the hooks row** — Change Kiro from "✗ No" to "~ 3 event types"
3. **Name the competitors** — Replace "Cloud SDD Tools" with "Kiro (AWS)" and "Cursor/Windsurf/Kiro" with specific names
4. **Add agent count row** — "Specky: 13 agents / Kiro: 1 / Spec Kit: 0 / Intent: 6"
5. **Add pipeline phase count** — "Specky: 10 phases / Kiro: 3 / Others: 0"
6. **Show real prices** — "$0 / $20-39/mo / Free / $60-200/mo" instead of "$$$"

### Strategic Moves (This Month)

7. **Add a "Specky vs. Kiro" dedicated comparison page** — Kiro is the primary competitor; give developers a detailed head-to-head
8. **Add social proof** — The site has zero testimonials. Even one GitHub star count or community quote would help
9. **Add a "Why not just use Kiro?" FAQ section** — Address the most obvious question directly
10. **Consider adding GitHub Spec Kit to the comparison** — It's free, MIT, and GitHub-official. Showing Specky wins against another free open-source tool strengthens the positioning

---

*Research date: April 14, 2026. Competitor data sourced from official websites, documentation, and third-party reviews.*
