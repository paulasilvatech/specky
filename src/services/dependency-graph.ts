/**
 * DependencyGraph — Maps tool dependencies and parallel execution opportunities.
 * Static utility class — import and use directly, no constructor needed.
 */

import { Phase, PHASE_ORDER } from "../constants.js";

interface ToolDependency {
  requires: string[];
  enables: string[];
  parallel_with: string[];
}

interface ExecutionGroup {
  sequential: string[];
  parallel_groups: string[][];
}

export class DependencyGraph {

  /** Get which tools can run in parallel for a given phase */
  static getParallelGroups(phase: Phase): ExecutionGroup {
    const groups: Record<Phase, ExecutionGroup> = {
      [Phase.Init]: {
        sequential: ["sdd_init"],
        parallel_groups: [],
      },
      [Phase.Discover]: {
        sequential: ["sdd_discover"],
        parallel_groups: [["sdd_scan_codebase"]],
      },
      [Phase.Specify]: {
        sequential: ["sdd_write_spec"],
        parallel_groups: [
          ["sdd_validate_ears", "sdd_generate_diagram"],
          ["sdd_import_transcript", "sdd_import_document", "sdd_turnkey_spec"],
        ],
      },
      [Phase.Clarify]: {
        sequential: ["sdd_clarify"],
        parallel_groups: [["sdd_validate_ears", "sdd_generate_diagram"]],
      },
      [Phase.Design]: {
        sequential: ["sdd_write_design"],
        parallel_groups: [
          ["sdd_generate_diagram", "sdd_generate_all_diagrams", "sdd_generate_api_docs"],
          ["sdd_figma_diagram"],
        ],
      },
      [Phase.Tasks]: {
        sequential: ["sdd_write_tasks"],
        parallel_groups: [
          ["sdd_generate_diagram", "sdd_export_work_items"],
        ],
      },
      [Phase.Analyze]: {
        sequential: ["sdd_run_analysis"],
        parallel_groups: [
          ["sdd_cross_analyze", "sdd_compliance_check", "sdd_checklist"],
          ["sdd_generate_all_diagrams", "sdd_generate_docs"],
        ],
      },
      [Phase.Implement]: {
        sequential: ["sdd_create_branch", "sdd_implement"],
        parallel_groups: [
          ["sdd_generate_iac", "sdd_generate_dockerfile", "sdd_setup_local_env"],
          ["sdd_generate_devcontainer", "sdd_setup_codespaces"],
        ],
      },
      [Phase.Verify]: {
        sequential: [],
        parallel_groups: [
          ["sdd_generate_tests", "sdd_generate_pbt", "sdd_verify_tasks"],
          ["sdd_check_sync", "sdd_checklist"],
        ],
      },
      [Phase.Release]: {
        sequential: ["sdd_create_pr"],
        parallel_groups: [
          ["sdd_generate_docs", "sdd_generate_api_docs", "sdd_generate_runbook", "sdd_generate_onboarding", "sdd_generate_all_docs"],
          ["sdd_export_work_items"],
        ],
      },
    };

    return groups[phase] || { sequential: [], parallel_groups: [] };
  }

  /** Get dependency info for a specific tool */
  static getDependencies(toolName: string): ToolDependency {
    const deps: Record<string, ToolDependency> = {
      // Pipeline tools
      sdd_init: {
        requires: [],
        enables: ["sdd_discover", "sdd_scan_codebase"],
        parallel_with: [],
      },
      sdd_discover: {
        requires: ["sdd_init"],
        enables: ["sdd_write_spec", "sdd_turnkey_spec", "sdd_import_transcript"],
        parallel_with: ["sdd_scan_codebase"],
      },
      sdd_write_spec: {
        requires: ["sdd_discover"],
        enables: ["sdd_clarify", "sdd_validate_ears", "sdd_generate_diagram"],
        parallel_with: [],
      },
      sdd_clarify: {
        requires: ["sdd_write_spec"],
        enables: ["sdd_write_design"],
        parallel_with: ["sdd_validate_ears", "sdd_generate_diagram"],
      },
      sdd_write_design: {
        requires: ["sdd_clarify"],
        enables: ["sdd_write_tasks", "sdd_generate_diagram", "sdd_generate_all_diagrams", "sdd_generate_api_docs"],
        parallel_with: [],
      },
      sdd_write_tasks: {
        requires: ["sdd_write_design"],
        enables: ["sdd_run_analysis", "sdd_export_work_items"],
        parallel_with: [],
      },
      sdd_run_analysis: {
        requires: ["sdd_write_tasks"],
        enables: ["sdd_implement", "sdd_create_branch", "sdd_generate_iac"],
        parallel_with: ["sdd_cross_analyze", "sdd_compliance_check", "sdd_checklist"],
      },
      // Quality tools (can run in parallel)
      sdd_cross_analyze: {
        requires: ["sdd_write_tasks"],
        enables: [],
        parallel_with: ["sdd_compliance_check", "sdd_checklist", "sdd_run_analysis"],
      },
      sdd_compliance_check: {
        requires: ["sdd_write_spec"],
        enables: [],
        parallel_with: ["sdd_cross_analyze", "sdd_checklist"],
      },
      sdd_checklist: {
        requires: ["sdd_write_spec"],
        enables: [],
        parallel_with: ["sdd_cross_analyze", "sdd_compliance_check"],
      },
      // Visualization tools (can run anytime after init)
      sdd_generate_diagram: {
        requires: [],
        enables: [],
        parallel_with: ["sdd_generate_all_diagrams", "sdd_validate_ears"],
      },
      sdd_generate_all_diagrams: {
        requires: [],
        enables: [],
        parallel_with: ["sdd_generate_diagram", "sdd_generate_docs"],
      },
      // Documentation tools (can run in parallel)
      sdd_generate_docs: {
        requires: ["sdd_run_analysis"],
        enables: [],
        parallel_with: ["sdd_generate_api_docs", "sdd_generate_runbook", "sdd_generate_onboarding", "sdd_generate_all_docs"],
      },
      sdd_generate_api_docs: {
        requires: ["sdd_write_design"],
        enables: [],
        parallel_with: ["sdd_generate_docs", "sdd_generate_runbook", "sdd_generate_onboarding"],
      },
      sdd_generate_runbook: {
        requires: ["sdd_write_design"],
        enables: [],
        parallel_with: ["sdd_generate_docs", "sdd_generate_api_docs", "sdd_generate_onboarding"],
      },
      sdd_generate_onboarding: {
        requires: ["sdd_write_design"],
        enables: [],
        parallel_with: ["sdd_generate_docs", "sdd_generate_api_docs", "sdd_generate_runbook"],
      },
      sdd_generate_all_docs: {
        requires: ["sdd_run_analysis"],
        enables: [],
        parallel_with: [],
      },
      // Implementation tools
      sdd_create_branch: {
        requires: ["sdd_run_analysis"],
        enables: ["sdd_implement"],
        parallel_with: ["sdd_generate_iac"],
      },
      sdd_implement: {
        requires: ["sdd_create_branch"],
        enables: ["sdd_verify_tasks"],
        parallel_with: [],
      },
      sdd_generate_iac: {
        requires: ["sdd_write_design"],
        enables: ["sdd_validate_iac"],
        parallel_with: ["sdd_generate_dockerfile", "sdd_create_branch"],
      },
      // Verification tools (can run in parallel)
      sdd_generate_tests: {
        requires: ["sdd_write_spec"],
        enables: ["sdd_verify_tests"],
        parallel_with: ["sdd_generate_pbt", "sdd_verify_tasks"],
      },
      sdd_generate_pbt: {
        requires: ["sdd_write_spec"],
        enables: [],
        parallel_with: ["sdd_generate_tests", "sdd_verify_tasks"],
      },
      sdd_verify_tasks: {
        requires: ["sdd_write_tasks"],
        enables: [],
        parallel_with: ["sdd_generate_tests", "sdd_generate_pbt"],
      },
      // Release tools
      sdd_create_pr: {
        requires: ["sdd_verify_tasks"],
        enables: [],
        parallel_with: ["sdd_export_work_items"],
      },
      sdd_export_work_items: {
        requires: ["sdd_write_tasks"],
        enables: [],
        parallel_with: ["sdd_create_pr"],
      },
      // Turnkey & auto
      sdd_turnkey_spec: {
        requires: [],
        enables: ["sdd_clarify", "sdd_write_design"],
        parallel_with: [],
      },
      sdd_auto_pipeline: {
        requires: [],
        enables: ["sdd_implement"],
        parallel_with: [],
      },
      sdd_checkpoint: {
        requires: [],
        enables: [],
        parallel_with: [],
      },
    };

    return deps[toolName] || {
      requires: [],
      enables: [],
      parallel_with: [],
    };
  }

  /** Get the recommended execution plan for the next steps from a given phase */
  static getExecutionPlan(currentPhase: Phase): {
    phase: Phase;
    next_steps: Array<{
      step: number;
      tools: string[];
      parallel: boolean;
      description: string;
    }>;
  } {
    const plans: Record<Phase, ReturnType<typeof DependencyGraph.getExecutionPlan>["next_steps"]> = {
      [Phase.Init]: [
        { step: 1, tools: ["sdd_discover"], parallel: false, description: "Answer discovery questions" },
        { step: 2, tools: ["sdd_scan_codebase"], parallel: true, description: "Optionally scan existing codebase" },
      ],
      [Phase.Discover]: [
        { step: 1, tools: ["sdd_write_spec"], parallel: false, description: "Write EARS requirements" },
        { step: 2, tools: ["sdd_validate_ears", "sdd_generate_diagram"], parallel: true, description: "Validate EARS + generate spec diagrams" },
      ],
      [Phase.Specify]: [
        { step: 1, tools: ["sdd_clarify"], parallel: false, description: "Generate clarification questions" },
        { step: 2, tools: ["sdd_validate_ears", "sdd_generate_diagram"], parallel: true, description: "Validate + visualize in parallel" },
      ],
      [Phase.Clarify]: [
        { step: 1, tools: ["sdd_write_design"], parallel: false, description: "Write system design (12 sections)" },
        { step: 2, tools: ["sdd_generate_all_diagrams", "sdd_generate_api_docs"], parallel: true, description: "Generate diagrams + API docs in parallel" },
      ],
      [Phase.Design]: [
        { step: 1, tools: ["sdd_write_tasks"], parallel: false, description: "Break down into implementation tasks" },
        { step: 2, tools: ["sdd_generate_diagram", "sdd_export_work_items"], parallel: true, description: "Generate task diagrams + export work items" },
      ],
      [Phase.Tasks]: [
        { step: 1, tools: ["sdd_run_analysis"], parallel: false, description: "Run quality analysis and gate decision" },
        { step: 2, tools: ["sdd_cross_analyze", "sdd_compliance_check", "sdd_checklist"], parallel: true, description: "Run all quality checks in parallel" },
      ],
      [Phase.Analyze]: [
        { step: 1, tools: ["sdd_create_branch"], parallel: false, description: "Create implementation branch" },
        { step: 2, tools: ["sdd_generate_iac", "sdd_generate_dockerfile", "sdd_setup_local_env"], parallel: true, description: "Generate IaC + dev environment in parallel" },
        { step: 3, tools: ["sdd_implement"], parallel: false, description: "Execute implementation plan" },
      ],
      [Phase.Implement]: [
        { step: 1, tools: ["sdd_generate_tests", "sdd_generate_pbt", "sdd_verify_tasks"], parallel: true, description: "Generate tests + verify tasks in parallel" },
        { step: 2, tools: ["sdd_check_sync"], parallel: false, description: "Check spec-code drift" },
      ],
      [Phase.Verify]: [
        { step: 1, tools: ["sdd_generate_docs", "sdd_generate_api_docs", "sdd_generate_runbook", "sdd_generate_onboarding"], parallel: true, description: "Generate all documentation in parallel" },
        { step: 2, tools: ["sdd_create_pr"], parallel: false, description: "Create pull request" },
        { step: 3, tools: ["sdd_export_work_items"], parallel: true, description: "Export work items for tracking" },
      ],
      [Phase.Release]: [],
    };

    return {
      phase: currentPhase,
      next_steps: plans[currentPhase] || [],
    };
  }
}
