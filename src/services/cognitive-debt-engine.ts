/**
 * CognitiveDebtEngine — Computes cognitive debt metrics from gate history.
 *
 * Cognitive debt occurs when developers approve AI-generated artifacts without
 * modification, accepting outputs they may not fully understand.
 *
 * Evidence: arXiv:2603.22106 (LGTM without modification as cognitive surrender signal)
 */

import type { GateHistoryEntry } from "../types.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface CognitiveDebtMetrics {
  lgtm_without_modification_rate: number;
  spec_to_implementation_delta: number;
  cognitive_debt_score: number;
  cognitive_debt_label: "healthy" | "caution" | "high_risk";
  total_gates: number;
  unmodified_gates: number;
}

export class CognitiveDebtEngine {
  computeMetrics(gateHistory: GateHistoryEntry[]): CognitiveDebtMetrics {
    if (gateHistory.length === 0) {
      return {
        lgtm_without_modification_rate: 0,
        spec_to_implementation_delta: 0,
        cognitive_debt_score: 0,
        cognitive_debt_label: "healthy",
        total_gates: 0,
        unmodified_gates: 0,
      };
    }

    const totalGates = gateHistory.length;
    const unmodifiedGates = gateHistory.filter((e) => !e.was_modified).length;
    const lgtmRate = Math.round((unmodifiedGates / totalGates) * 100);

    // spec_to_implementation_delta: compare req_count at specify vs verify
    const specEntry = [...gateHistory].reverse().find((e) => e.phase === "specify");
    const verifyEntry = [...gateHistory].reverse().find((e) => e.phase === "verify");
    const specCount = specEntry?.req_count ?? 0;
    const verifyCount = verifyEntry?.req_count ?? 0;
    const delta = Math.abs(specCount - verifyCount);

    // Composite score: 60% lgtm_rate + 40% delta_normalized
    const deltaNormalized = specCount > 0 ? Math.min((delta / specCount) * 100, 100) : 0;
    const score = Math.round(lgtmRate * 0.6 + deltaNormalized * 0.4);

    const label: CognitiveDebtMetrics["cognitive_debt_label"] =
      score <= 30 ? "healthy" : score <= 70 ? "caution" : "high_risk";

    return {
      lgtm_without_modification_rate: lgtmRate,
      spec_to_implementation_delta: delta,
      cognitive_debt_score: score,
      cognitive_debt_label: label,
      total_gates: totalGates,
      unmodified_gates: unmodifiedGates,
    };
  }

  async persistMetrics(specDir: string, metrics: CognitiveDebtMetrics): Promise<void> {
    const metricsDir = join(specDir, ".specky");
    await mkdir(metricsDir, { recursive: true });
    const metricsPath = join(metricsDir, "metrics.json");
    await writeFile(metricsPath, JSON.stringify({ ...metrics, persisted_at: new Date().toISOString() }, null, 2), "utf8");
  }
}
