/**
 * routing-helper.ts — Injects model_routing_hint into any tool response object.
 * Single helper used by all 53+ tools to avoid duplicating routing logic.
 */

import type { ComplexitySignal } from "../services/model-routing-engine.js";
import { ModelRoutingEngine } from "../services/model-routing-engine.js";

const engine = new ModelRoutingEngine();

/**
 * Appends `model_routing_hint` to a response object (mutates in place).
 * Phase is inferred from the tool name when not provided explicitly.
 */
export function appendRoutingHint<T extends Record<string, unknown>>(
  response: T,
  phase: string,
  signals?: ComplexitySignal,
): T & { model_routing_hint: ReturnType<ModelRoutingEngine["getHint"]> } {
  const hint = engine.getHint(phase, signals);
  return Object.assign(response, { model_routing_hint: hint }) as T & {
    model_routing_hint: ReturnType<ModelRoutingEngine["getHint"]>;
  };
}

export { engine as routingEngine };
