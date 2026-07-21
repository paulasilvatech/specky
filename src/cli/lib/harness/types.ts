/**
 * harness/types.ts — Primitive Intermediate Representation (IR) and the
 * per-harness compiler contract.
 *
 * Specky keeps a single canonical primitive source in `.apm/`. Each supported
 * agent harness (GitHub Copilot, Claude Code, and future targets) has a
 * compiler that renders those primitives into that harness's native file
 * layout and tool vocabulary. Adding a new harness means adding a new
 * `HarnessCompiler` — never hand-editing agents/prompts per platform.
 */

/**
 * Supported harness targets. Extend this union and register a compiler in
 * `harness/index.ts` to add a new harness (e.g. "codex", "gemini", "kiro").
 * New targets must also add native tool mappings in `harness/tool-map.ts`.
 */
export type HarnessTarget = "copilot" | "claude" | "cursor" | "opencode" | "agent-skills";

/**
 * Canonical, harness-agnostic tool vocabulary. Primitive sources are authored
 * against native Copilot tokens today; `normalizeToLogical` folds any known
 * native token into one of these logical ids, and `logicalToNative` renders a
 * logical id back into the tokens a specific harness understands.
 */
export type LogicalTool =
  | "workspace.search"
  | "workspace.edit"
  | "workspace.command"
  | "web.fetch"
  | "agent.delegate"
  | "todo.write"
  | `mcp.specky.${string}`
  | `raw:${string}`;

/**
 * Canonical agent capability vocabulary. Canonical `.apm` agents declare
 * capabilities; compilers render them into the target's native tool tokens.
 * Command subtypes retain the least-privilege intent needed by host-specific
 * permission profiles while sharing one native command tool per harness.
 */
export type AgentCapability =
  | "workspace.read"
  | "workspace.edit"
  | "workspace.command.git"
  | "workspace.command.test"
  | "workspace.command.release-gates"
  | "web.fetch"
  | "agent.delegate"
  | "todo.write"
  | `mcp.specky.${string}`
  | `mcp.github.${string}`;

export interface HarnessCompileOptions {
  integrations?: readonly string[];
}

/**
 * A compiler renders canonical primitive files into one harness's native
 * form. Content transforms operate on raw file text (frontmatter + body);
 * renamers map source filenames to the harness's expected extension.
 */
export interface HarnessCompiler {
  readonly target: HarnessTarget;
  /** Transform an agent markdown file (frontmatter `tools:` line, etc.). */
  compileAgent(content: string, opts?: HarnessCompileOptions): string;
  /** Transform a prompt/command markdown file. */
  compilePrompt(content: string): string;
  /** Transform an instruction/rules markdown file. */
  compileInstruction(content: string): string;
  /** Map an agent source filename to the harness's expected filename. */
  renameAgent(fileName: string): string;
  /** Map a prompt source filename to the harness's expected filename. */
  renamePrompt(fileName: string): string;
}
