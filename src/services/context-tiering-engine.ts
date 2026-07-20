/**
 * ContextTieringEngine — Static tier assignment for SDD spec artifacts.
 *
 * Tiers:
 *  Hot    — loaded on every tool call (CONSTITUTION.md)
 *  Domain — loaded when the tool operates on a specific spec_dir
 *  Cold   — loaded on-demand only when a tool explicitly requests it
 */

export type ContextTier = "hot" | "domain" | "cold";

export interface ContextLoadSummary {
  hot_loaded: boolean;
  domain_files: string[];
  cold_files: string[];
  estimated_tokens: number;
  vs_universal_tokens: number;
  savings_percent: number;
}

export interface TierEntry {
  filename: string;
  tier: ContextTier;
}

export class ContextTieringEngine {
  private static readonly TIER_TABLE: Record<string, ContextTier> = {
    "CONSTITUTION.md": "hot",
    "SPECIFICATION.md": "domain",
    "DESIGN.md": "domain",
    "TASKS.md": "domain",
    "ANALYSIS.md": "cold",
    "CHECKLIST.md": "cold",
    "VERIFICATION.md": "cold",
    "RESEARCH.md": "cold",
    "COMPLIANCE.md": "cold",
    "CROSS_ANALYSIS.md": "cold",
  };

  private static readonly ALL_FILES = Object.keys(ContextTieringEngine.TIER_TABLE);

  // Average size assumptions per file in characters (for universal load estimate)
  private static readonly AVG_FILE_CHARS = 4000;

  getTier(filename: string): ContextTier {
    return ContextTieringEngine.TIER_TABLE[filename] ?? "cold";
  }

  getTierTable(): TierEntry[] {
    return ContextTieringEngine.ALL_FILES.map((filename) => ({
      filename,
      tier: ContextTieringEngine.TIER_TABLE[filename]!,
    }));
  }

  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  buildContextLoadSummary(loaded: {
    domainFiles: string[];
    coldFiles: string[];
    domainContent: string;
    coldContent: string;
  }): ContextLoadSummary {
    const hotEstimate = ContextTieringEngine.AVG_FILE_CHARS / 4; // CONSTITUTION.md
    const domainEstimate = this.estimateTokens(loaded.domainContent);
    const coldEstimate = this.estimateTokens(loaded.coldContent);
    const estimatedTokens = Math.ceil(hotEstimate) + domainEstimate + coldEstimate;

    // Universal estimate: all 10 artifacts at average size
    const universalTokens = Math.ceil(
      (ContextTieringEngine.ALL_FILES.length * ContextTieringEngine.AVG_FILE_CHARS) / 4,
    );

    const savingsPercent =
      universalTokens > 0 ? Math.round((1 - estimatedTokens / universalTokens) * 100) : 0;

    return {
      hot_loaded: true,
      domain_files: loaded.domainFiles,
      cold_files: loaded.coldFiles,
      estimated_tokens: estimatedTokens,
      vs_universal_tokens: universalTokens,
      savings_percent: Math.max(0, savingsPercent),
    };
  }

  /** Build a default summary for stateless responses (no spec_dir context). */
  buildHotOnlySummary(): ContextLoadSummary {
    return this.buildContextLoadSummary({
      domainFiles: [],
      coldFiles: [],
      domainContent: "",
      coldContent: "",
    });
  }
}
