/**
 * MethodologyGuide — Static educational content for SDD pipeline phases and tools.
 * Provides explanations, progress indicators, and best practices.
 * No constructor dependencies — import and use directly.
 */

import { Phase, PHASE_ORDER } from "../constants.js";
import type { PhaseStatus } from "../types.js";

export class MethodologyGuide {

  /** Get comprehensive explanation for a pipeline phase */
  static getPhaseExplanation(phase: Phase): {
    what: string;
    why: string;
    how: string;
    anti_patterns: string[];
    best_practices: string[];
    sdd_principle: string;
  } {
    const explanations: Record<Phase, ReturnType<typeof MethodologyGuide.getPhaseExplanation>> = {
      [Phase.Init]: {
        what: "Initialize the project constitution — the foundational charter that defines scope, principles, and constraints.",
        why: "Without a constitution, scope creep is inevitable. The constitution is the single source of truth for what the project IS and IS NOT.",
        how: "Call sdd_init with your project name. This creates CONSTITUTION.md with guiding principles and constraints.",
        anti_patterns: [
          "Skipping constitution and jumping to requirements",
          "Making the constitution too vague ('build a good system')",
          "Not defining what is OUT of scope",
        ],
        best_practices: [
          "Define 3-5 guiding principles that drive decisions",
          "Explicitly list what is OUT of scope",
          "Keep it concise — constitution is a compass, not a map",
        ],
        sdd_principle: "Every project needs a north star. The constitution prevents drift by anchoring all decisions to agreed principles.",
      },
      [Phase.Discover]: {
        what: "Explore the problem space through structured discovery questions covering scope, users, constraints, integrations, performance, security, and deployment.",
        why: "Discovery prevents building the wrong thing. 70% of project failures trace back to poor requirements gathering.",
        how: "Call sdd_discover with your project idea. Answer all 7 questions thoroughly — these answers feed directly into requirements.",
        anti_patterns: [
          "Rushing through discovery to start coding",
          "Answering questions with assumptions instead of facts",
          "Ignoring non-functional requirements (performance, security)",
        ],
        best_practices: [
          "Interview actual users or stakeholders if possible",
          "Document unknowns as research items",
          "Consider edge cases and failure scenarios early",
        ],
        sdd_principle: "Ask before you build. Discovery questions are cheaper than rework.",
      },
      [Phase.Specify]: {
        what: "Write formal requirements in EARS notation (Easy Approach to Requirements Syntax). Each requirement is testable and traceable.",
        why: "EARS notation eliminates ambiguity. Every requirement follows a pattern (ubiquitous, event-driven, state-driven, optional, unwanted) that makes it directly testable.",
        how: "Call sdd_write_spec with structured requirements. Each requirement needs an ID (REQ-CAT-NNN), EARS pattern, text, and acceptance criteria.",
        anti_patterns: [
          "Writing vague requirements ('the system should be fast')",
          "Missing acceptance criteria",
          "Not categorizing requirements by type",
        ],
        best_practices: [
          "Every requirement starts with a clear EARS pattern keyword",
          "Each acceptance criterion is independently testable",
          "Use positive framing: describe what the system DOES, not what it doesn't",
        ],
        sdd_principle: "If you can't test it, you can't build it. EARS ensures every requirement has a clear pass/fail criterion.",
      },
      [Phase.Clarify]: {
        what: "Review requirements for ambiguity, gaps, and inconsistencies. Generate clarification questions for unclear areas.",
        why: "Catching ambiguity now costs 1x. Catching it during implementation costs 10x. Catching it in production costs 100x.",
        how: "Call sdd_clarify to analyze your SPECIFICATION.md. Answer the clarification questions and update the spec if needed.",
        anti_patterns: [
          "Skipping clarification because 'it looks fine'",
          "Assuming everyone interprets requirements the same way",
          "Not updating the spec after clarification",
        ],
        best_practices: [
          "Review each requirement from the perspective of different stakeholders",
          "Look for implicit assumptions that should be explicit",
          "Ensure error handling and edge cases are covered",
        ],
        sdd_principle: "Ambiguity is the enemy of quality. What seems obvious to you may be interpreted differently by others.",
      },
      [Phase.Design]: {
        what: "Create the system architecture covering all 12 design areas: context, containers, components, code, data, APIs, infrastructure, security, ADRs, error handling, diagrams, and cross-cutting concerns.",
        why: "Design translates requirements into a buildable blueprint. Without design, implementation is improvisation.",
        how: "Call sdd_write_design with architecture overview, Mermaid diagrams, ADRs, and API contracts. Use the expanded 12-section template.",
        anti_patterns: [
          "Designing only the happy path",
          "Ignoring security architecture until later",
          "Not recording architecture decisions (ADRs)",
          "Over-engineering: adding complexity without requirements to justify it",
        ],
        best_practices: [
          "Use C4 model: Context → Container → Component → Code",
          "Record every significant decision as an ADR",
          "Design for the current requirements, not hypothetical future ones",
          "Include error handling and failure modes in every component",
        ],
        sdd_principle: "Design is the bridge between what and how. Every design element must trace back to a requirement.",
      },
      [Phase.Tasks]: {
        what: "Decompose the design into implementation tasks with dependencies, effort estimates, parallel markers, and requirement traceability.",
        why: "Task breakdown makes the work plannable, estimable, and trackable. Dependencies prevent integration issues.",
        how: "Call sdd_write_tasks with structured tasks. Each task needs an ID, dependencies, effort (S/M/L), and traces_to requirements.",
        anti_patterns: [
          "Creating tasks too large to complete in one session",
          "Missing dependency relationships between tasks",
          "Not tracing tasks back to requirements",
        ],
        best_practices: [
          "Each task should be completable in 1-4 hours",
          "Mark tasks that can run in parallel with [P]",
          "Include pre-implementation gates tied to Constitution articles",
          "Every task traces to at least one requirement",
        ],
        sdd_principle: "Small, traceable tasks are the unit of progress. If a task can't be traced to a requirement, question why it exists.",
      },
      [Phase.Analyze]: {
        what: "Run quality analysis: traceability matrix, coverage assessment, compliance checks, and generate a gate decision (APPROVE/CHANGES_NEEDED/BLOCK).",
        why: "Analysis is the quality gate. It catches gaps, orphaned requirements, and missing coverage before implementation begins.",
        how: "Call sdd_run_analysis to generate ANALYSIS.md with gate decision. The gate must be APPROVE before advancing.",
        anti_patterns: [
          "Ignoring a CHANGES_NEEDED or BLOCK decision",
          "Gaming the gate by adding superficial content",
          "Not running compliance checks for regulated domains",
        ],
        best_practices: [
          "Address all gaps identified in the analysis",
          "Run sdd_cross_analyze for multi-spec consistency",
          "Run sdd_compliance_check if the domain requires it",
          "Create a checkpoint before and after analysis",
        ],
        sdd_principle: "The gate exists to protect quality. Passing the gate means the specification is complete, consistent, and implementable.",
      },
      [Phase.Implement]: {
        what: "Execute the implementation plan: create branches, write code following the task breakdown, generate IaC if needed.",
        why: "Structured implementation following the task plan prevents ad-hoc coding and ensures every code change traces to a requirement.",
        how: "Call sdd_implement for the execution plan. Use sdd_create_branch, sdd_generate_iac, and follow the task sequence.",
        anti_patterns: [
          "Ignoring the task sequence and implementing ad-hoc",
          "Not creating a branch before starting",
          "Skipping pre-implementation gates",
        ],
        best_practices: [
          "Follow the task dependency order strictly",
          "Run parallel tasks simultaneously where marked [P]",
          "Create checkpoints at implementation milestones",
          "Run security-scan hook before committing",
        ],
        sdd_principle: "Code is the artifact of the plan. Every line should trace back through tasks → design → requirements.",
      },
      [Phase.Verify]: {
        what: "Verify that all tasks are complete, tests pass, and the implementation matches the specification.",
        why: "Verification closes the loop: it ensures what was built matches what was specified, with no phantom completions.",
        how: "Call sdd_verify_tasks to detect phantom completions. Generate tests with sdd_generate_tests and PBT with sdd_generate_pbt.",
        anti_patterns: [
          "Marking tasks complete without evidence",
          "Skipping property-based testing",
          "Not checking for spec-code drift",
        ],
        best_practices: [
          "Run sdd_verify_tasks to catch phantom completions",
          "Generate both unit tests and property-based tests",
          "Check spec-code sync with sdd_check_sync",
          "Run the full quality checklist",
        ],
        sdd_principle: "Trust but verify. Verification ensures the implementation is faithful to the specification.",
      },
      [Phase.Release]: {
        what: "Prepare for release: generate documentation, create PR, export work items, update changelog.",
        why: "Release preparation ensures the work is documented, reviewable, and traceable for future maintenance.",
        how: "Call sdd_generate_docs for documentation, sdd_create_pr for pull request, sdd_export_work_items for tracking.",
        anti_patterns: [
          "Skipping documentation generation",
          "Creating PRs without linking to specifications",
          "Not generating the SDD Journey document",
        ],
        best_practices: [
          "Generate all documentation types in parallel",
          "Include the SDD Journey document for traceability",
          "Link the PR to the specification and analysis",
          "Export work items for project tracking",
        ],
        sdd_principle: "Release is not the end — it's the handoff. Good documentation ensures the next person can understand and maintain the work.",
      },
    };

    return explanations[phase];
  }

  /** Get ASCII progress indicator for current pipeline state */
  static getProgressIndicator(
    currentPhase: Phase,
    phases: Record<Phase, PhaseStatus>
  ): {
    progress_bar: string;
    completed_phases: Phase[];
    remaining_phases: Phase[];
    percent_complete: number;
    current_phase_name: string;
  } {
    const completed: Phase[] = [];
    const remaining: Phase[] = [];

    for (const phase of PHASE_ORDER) {
      if (phases[phase]?.status === "completed") {
        completed.push(phase);
      } else {
        remaining.push(phase);
      }
    }

    const percent = Math.round((completed.length / PHASE_ORDER.length) * 100);
    const filledCount = Math.round(completed.length * 2);  // 20 chars total for 10 phases
    const emptyCount = 20 - filledCount;
    const bar = `[${"=".repeat(filledCount)}>${".".repeat(Math.max(0, emptyCount - 1))}] ${completed.length}/${PHASE_ORDER.length} phases (${percent}%)`;

    return {
      progress_bar: bar,
      completed_phases: completed,
      remaining_phases: remaining,
      percent_complete: percent,
      current_phase_name: currentPhase,
    };
  }

  /** Get educational explanation for a specific tool */
  static getToolExplanation(toolName: string): {
    what_it_does: string;
    why_it_matters: string;
    common_mistakes: string[];
  } {
    const explanations: Record<string, ReturnType<typeof MethodologyGuide.getToolExplanation>> = {
      sdd_init: {
        what_it_does: "Creates the project constitution and initializes the SDD pipeline state machine.",
        why_it_matters: "The constitution defines scope, principles, and constraints — it's the foundation all other artifacts build upon.",
        common_mistakes: ["Not defining constraints", "Too vague principles", "Forgetting to set scope boundaries"],
      },
      sdd_discover: {
        what_it_does: "Generates 7 structured discovery questions covering scope, users, constraints, integrations, performance, security, and deployment.",
        why_it_matters: "Discovery prevents building the wrong thing. These questions surface hidden requirements and constraints early.",
        common_mistakes: ["Rushing through answers", "Answering with assumptions instead of facts", "Skipping security/performance questions"],
      },
      sdd_write_spec: {
        what_it_does: "Writes SPECIFICATION.md with requirements in EARS notation, each with acceptance criteria and traceability.",
        why_it_matters: "EARS notation ensures every requirement is testable. The specification is the contract between what's needed and what's built.",
        common_mistakes: ["Vague requirements without EARS patterns", "Missing acceptance criteria", "Not validating EARS compliance"],
      },
      sdd_clarify: {
        what_it_does: "Analyzes SPECIFICATION.md for ambiguity and generates up to 5 clarification questions.",
        why_it_matters: "Ambiguity caught now is 100x cheaper than ambiguity caught in production.",
        common_mistakes: ["Skipping clarification entirely", "Not updating spec after answering questions"],
      },
      sdd_write_design: {
        what_it_does: "Generates DESIGN.md with 12-section system design covering C4 architecture, data model, APIs, security, infrastructure, and ADRs.",
        why_it_matters: "Design is the blueprint. Without it, implementation is improvisation that leads to technical debt.",
        common_mistakes: ["Only designing happy path", "No ADRs", "Ignoring security architecture", "Missing error handling strategy"],
      },
      sdd_write_tasks: {
        what_it_does: "Creates TASKS.md with sequenced implementation tasks, dependencies, effort estimates, and requirement traceability.",
        why_it_matters: "Task breakdown makes work plannable and trackable. Dependencies prevent integration failures.",
        common_mistakes: ["Tasks too large", "Missing dependencies", "No traceability to requirements"],
      },
      sdd_run_analysis: {
        what_it_does: "Generates ANALYSIS.md with traceability matrix and gate decision (APPROVE/CHANGES_NEEDED/BLOCK).",
        why_it_matters: "The quality gate prevents incomplete specifications from reaching implementation. It enforces traceability.",
        common_mistakes: ["Ignoring BLOCK decisions", "Not addressing gaps", "Not re-running after fixes"],
      },
      sdd_advance_phase: {
        what_it_does: "Validates prerequisites and advances the pipeline to the next phase.",
        why_it_matters: "Phase advancement ensures all artifacts are in place before moving forward. It enforces the SDD methodology.",
        common_mistakes: ["Trying to skip phases", "Not creating required files first", "Ignoring gate decisions"],
      },
      sdd_generate_diagram: {
        what_it_does: "Generates a specific Mermaid diagram from specification artifacts. Supports 17 diagram types.",
        why_it_matters: "Diagrams communicate architecture visually. They catch design issues that text alone might miss.",
        common_mistakes: ["Only generating one diagram type", "Not generating from all artifact sources"],
      },
      sdd_generate_all_diagrams: {
        what_it_does: "Generates ALL applicable diagram types for a feature in a single call.",
        why_it_matters: "Comprehensive diagrams provide different views of the same system — each reveals different insights.",
        common_mistakes: ["Not running this after design changes", "Not reviewing all generated diagrams"],
      },
      sdd_checkpoint: {
        what_it_does: "Creates a named snapshot of all specification artifacts and pipeline state.",
        why_it_matters: "Checkpoints enable safe experimentation — you can always restore to a known-good state.",
        common_mistakes: ["Not checkpointing before major changes", "Not labeling checkpoints descriptively"],
      },
      sdd_generate_docs: {
        what_it_does: "Generates comprehensive project documentation from all specification artifacts.",
        why_it_matters: "Documentation is the bridge between the team that built it and the team that maintains it.",
        common_mistakes: ["Generating docs only at the end", "Not including the SDD journey"],
      },
      sdd_turnkey_spec: {
        what_it_does: "Generates a complete EARS specification from a natural language description. Auto-extracts requirements and classifies EARS patterns.",
        why_it_matters: "Turnkey lowers the barrier to starting SDD. Even a rough description becomes a structured, testable specification.",
        common_mistakes: ["Not reviewing generated requirements", "Skipping clarification after turnkey", "Not refining with clarification_responses"],
      },
      sdd_get_template: {
        what_it_does: "Returns a raw Markdown template with {{placeholder}} variables for any SDD artifact type (constitution, specification, design, tasks, etc.).",
        why_it_matters: "Templates ensure consistency across projects. They encode best practices and required sections so nothing is missed.",
        common_mistakes: ["Using templates without customizing placeholders", "Not reading the template structure before filling it in"],
      },
      sdd_scan_codebase: {
        what_it_does: "Scans the workspace to detect programming language, framework, package manager, and project structure for auto-steering.",
        why_it_matters: "Codebase context drives better requirements and design decisions. Knowing the tech stack prevents incompatible choices.",
        common_mistakes: ["Ignoring scan results when writing specs", "Not running scan before discovery phase"],
      },
      sdd_check_ecosystem: {
        what_it_does: "Reports which external MCP servers are recommended for the full Specky experience, with install commands and integration details.",
        why_it_matters: "MCP-to-MCP routing transforms Specky from a spec engine into a complete development platform. Each server unlocks new integrations.",
        common_mistakes: ["Not installing GitHub MCP for PR/issue integration", "Missing MarkItDown MCP for document import"],
      },
      sdd_generate_all_docs: {
        what_it_does: "Generates ALL documentation types in parallel: full docs, API docs, runbook, onboarding guide, and SDD journey.",
        why_it_matters: "Parallel generation is faster and ensures consistency. The SDD journey document provides a complete audit trail.",
        common_mistakes: ["Not generating journey docs", "Running individual doc tools instead of this all-in-one"],
      },
      sdd_check_sync: {
        what_it_does: "Checks for spec-code drift by comparing specification artifacts against the current codebase state.",
        why_it_matters: "Drift between spec and code is the #1 cause of documentation rot. Regular sync checks catch divergence early.",
        common_mistakes: ["Not running sync checks after code changes", "Ignoring drift warnings"],
      },
      sdd_generate_pbt: {
        what_it_does: "Generates property-based tests from EARS requirements using fast-check (TypeScript) or Hypothesis (Python).",
        why_it_matters: "Property-based testing finds edge cases that example-based tests miss. EARS requirements map directly to testable properties.",
        common_mistakes: ["Only generating example-based tests", "Not reviewing generated property definitions"],
      },
    };

    return explanations[toolName] || {
      what_it_does: `Executes the ${toolName} operation in the SDD pipeline.`,
      why_it_matters: "Each tool in the SDD pipeline contributes to traceability between requirements, design, and implementation.",
      common_mistakes: ["Not reading the tool's output carefully", "Not following the suggested next_steps"],
    };
  }
}
