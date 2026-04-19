/**
 * ide-detect.ts — Detect which AI IDEs are in use for the current workspace.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type IdeTarget = "claude" | "copilot" | "both";

export interface DetectionResult {
  claudeCode: boolean;
  copilot: boolean;
  recommendation: IdeTarget;
  signals: string[];
}

export function detectIde(workspace: string): DetectionResult {
  const signals: string[] = [];

  const claudeSignals = [
    ".claude",
    ".mcp.json",
    "CLAUDE.md",
  ];
  const copilotSignals = [
    ".github/copilot-instructions.md",
    ".github/agents",
    ".github/prompts",
    ".vscode/mcp.json",
    ".vscode/settings.json",
  ];

  let claudeCode = false;
  let copilot = false;

  for (const s of claudeSignals) {
    if (existsSync(resolve(workspace, s))) {
      claudeCode = true;
      signals.push(`claude:${s}`);
    }
  }
  for (const s of copilotSignals) {
    if (existsSync(resolve(workspace, s))) {
      copilot = true;
      signals.push(`copilot:${s}`);
    }
  }

  // Default: install for both when signals are ambiguous.
  let recommendation: IdeTarget;
  if (claudeCode && !copilot) recommendation = "claude";
  else if (copilot && !claudeCode) recommendation = "copilot";
  else recommendation = "both";

  return { claudeCode, copilot, recommendation, signals };
}
