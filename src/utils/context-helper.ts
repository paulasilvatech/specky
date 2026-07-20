/**
 * context-helper.ts — Injects context_load_summary into tool responses.
 * Used by buildToolResponse in response-builder.ts to cover all tools.
 */

import type { ContextLoadSummary } from "../services/context-tiering-engine.js";
import { ContextTieringEngine } from "../services/context-tiering-engine.js";

const tieringEngine = new ContextTieringEngine();

export function buildDefaultContextSummary(): ContextLoadSummary {
  return tieringEngine.buildHotOnlySummary();
}

export function appendContextSummary<T extends Record<string, unknown>>(
  response: T,
  summary: ContextLoadSummary,
): T & { context_load_summary: ContextLoadSummary } {
  return Object.assign(response, { context_load_summary: summary }) as T & {
    context_load_summary: ContextLoadSummary;
  };
}

export { tieringEngine };
