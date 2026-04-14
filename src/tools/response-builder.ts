/**
 * ResponseBuilder — Enriches tool responses with phase context, educational content,
 * handoff information, and parallel execution hints.
 */

import { Phase } from "../constants.js";
import type { PhaseStatus, HandoffContext, ParallelHint } from "../types.js";
import { MethodologyGuide } from "../services/methodology.js";
import { DependencyGraph } from "../services/dependency-graph.js";
import { routingEngine } from "../utils/routing-helper.js";
import { buildDefaultContextSummary } from "../utils/context-helper.js";

interface PhaseContext {
  current_phase: Phase;
  phase_progress: string;
  phases_completed: Phase[];
  completion_percent: number;
}

/**
 * Build an enriched tool response with phase context and educational content.
 */
export function buildToolResponse(
  toolName: string,
  result: Record<string, unknown>,
  currentPhase: Phase,
  phases: Record<Phase, PhaseStatus>,
  options?: {
    completedPhase?: Phase;
    nextPhase?: Phase;
    artifactsProduced?: string[];
    summaryOfWork?: string;
  }
): Record<string, unknown> {
  // Phase context
  const progress = MethodologyGuide.getProgressIndicator(currentPhase, phases);
  const phaseContext: PhaseContext = {
    current_phase: currentPhase,
    phase_progress: progress.progress_bar,
    phases_completed: progress.completed_phases,
    completion_percent: progress.percent_complete,
  };

  // Educational content
  const toolExplanation = MethodologyGuide.getToolExplanation(toolName);
  const phaseExplanation = MethodologyGuide.getPhaseExplanation(currentPhase);

  // Handoff context (if phase transition occurred)
  let handoff: HandoffContext | undefined;
  if (options?.completedPhase && options?.nextPhase) {
    const nextExplanation = MethodologyGuide.getPhaseExplanation(options.nextPhase);
    handoff = {
      completed_phase: options.completedPhase,
      next_phase: options.nextPhase,
      artifacts_produced: options.artifactsProduced || [],
      summary_of_work: options.summaryOfWork || `Completed ${options.completedPhase} phase.`,
      what_comes_next: nextExplanation.what,
      methodology_note: nextExplanation.sdd_principle,
    };
  }

  // Parallel execution hints
  const deps = DependencyGraph.getDependencies(toolName);
  const executionPlan = DependencyGraph.getExecutionPlan(currentPhase);
  const parallelOpportunities: ParallelHint = {
    can_run_now: deps.parallel_with,
    must_wait_for: deps.requires.filter(r => !progress.completed_phases.includes(r as Phase)),
    explanation: executionPlan.next_steps.length > 0
      ? `Next: ${executionPlan.next_steps[0].description}${executionPlan.next_steps[0].parallel ? " (can run in parallel)" : ""}`
      : "Pipeline complete.",
  };

  return {
    ...result,
    phase_context: phaseContext,
    handoff,
    parallel_opportunities: parallelOpportunities,
    educational_note: toolExplanation.why_it_matters,
    methodology_tip: phaseExplanation.sdd_principle,
    model_routing_hint: routingEngine.getHint(currentPhase),
    context_load_summary: buildDefaultContextSummary(),
  };
}

/**
 * Convenience wrapper: loads state from StateMachine and enriches a tool response.
 * This is the primary function tools should call — handles state loading internally.
 */
export async function enrichResponse(
  toolName: string,
  result: Record<string, unknown>,
  stateMachine: { loadState(specDir: string): Promise<{ current_phase: Phase; phases: Record<Phase, PhaseStatus> }> },
  specDir: string,
  options?: {
    completedPhase?: Phase;
    nextPhase?: Phase;
    artifactsProduced?: string[];
    summaryOfWork?: string;
  }
): Promise<Record<string, unknown>> {
  try {
    const state = await stateMachine.loadState(specDir);
    return buildToolResponse(toolName, result, state.current_phase, state.phases, options);
  } catch {
    // If state can't be loaded, return result as-is with minimal enrichment
    return {
      ...result,
      educational_note: MethodologyGuide.getToolExplanation(toolName).why_it_matters,
    };
  }
}

/**
 * Enrich a stateless tool response (tools without spec_dir or stateMachine).
 * Provides educational content without phase context.
 */
export function enrichStateless(
  toolName: string,
  result: Record<string, unknown>,
): Record<string, unknown> {
  const toolExplanation = MethodologyGuide.getToolExplanation(toolName);
  return {
    ...result,
    educational_note: toolExplanation.why_it_matters,
    common_mistakes: toolExplanation.common_mistakes,
    sdd_context: "This is a utility tool that operates independently of the SDD pipeline phase. It can be called at any time to support your workflow.",
  };
}

/**
 * Build a validation error response when a tool is called in the wrong phase.
 */
export function buildPhaseError(
  toolName: string,
  currentPhase: Phase,
  expectedPhases: Phase[],
  errorMessage: string
): Record<string, unknown> {
  const phaseExplanation = MethodologyGuide.getPhaseExplanation(currentPhase);
  return {
    error: "phase_validation_failed",
    tool: toolName,
    current_phase: currentPhase,
    expected_phases: expectedPhases,
    message: errorMessage,
    fix: `Complete the ${currentPhase} phase first. ${phaseExplanation.how}`,
    methodology_note: phaseExplanation.sdd_principle,
  };
}
