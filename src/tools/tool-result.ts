/**
 * tool-result.ts — the single source of truth for building MCP tool results.
 *
 * Replaces the copy-pasted `formatError` (16×), `truncate` (17×), and the
 * `{ content: [{ type: "text" as const, text: ... }] }` envelope (127×) that
 * were duplicated across every tool file.
 */
import { CHARACTER_LIMIT } from "../constants.js";

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Truncate an over-long payload to the MCP character budget. */
export function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n[TRUNCATED] Response exceeded 25,000 characters. Use sdd_get_status to see current state."
  );
}

/** Format a thrown value into the standard `[tool] Error: message` string. */
export function formatError(toolName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[${toolName}] Error: ${message}`;
}

/** Wrap raw text as a (truncated) MCP text result. */
export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text: truncate(text) }] };
}

/** Serialize a payload to pretty JSON and wrap it as a (truncated) text result. */
export function jsonResult(payload: unknown): ToolResult {
  return textResult(JSON.stringify(payload, null, 2));
}

/** Build a consistent error result. Accepts an Error or any thrown value. */
export function errorResult(toolName: string, error: unknown): ToolResult {
  return {
    content: [{ type: "text", text: formatError(toolName, error) }],
    isError: true,
  };
}
