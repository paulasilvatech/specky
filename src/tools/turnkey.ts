/**
 * Turnkey Tool — sdd_turnkey_spec.
 * Generates full EARS specification from a natural language description.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { z } from "zod";
import { CHARACTER_LIMIT, Phase } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import type { EarsValidator } from "../services/ears-validator.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED]";
}

// Inline schema
const turnkeySpecInputSchema = z.object({
  feature_name: z
    .string()
    .min(1)
    .max(200)
    .describe("Human-readable feature name (e.g. 'user-authentication')"),
  description: z
    .string()
    .min(10)
    .max(10000)
    .describe("Natural language description of the feature. Can be a paragraph, bullet points, or a meeting summary. The tool will extract EARS requirements automatically."),
  feature_number: z
    .string()
    .regex(/^\d{3}$/, "Feature number must be 3 digits, e.g. '001'")
    .default("001")
    .describe("Feature number (zero-padded, e.g. '001')"),
  spec_dir: z
    .string()
    .default(".specs")
    .describe("Spec directory path"),
  force: z
    .boolean()
    .default(false)
    .describe("Overwrite existing files if true"),
  clarification_responses: z
    .record(z.string(), z.string())
    .optional()
    .describe("Answers to clarification questions from a previous turnkey run. Keys are question IDs (CQ-001), values are answers. When provided, the tool refines the existing specification instead of generating from scratch."),
}).strict().describe(
  "Turnkey specification: provide a natural language description and get a complete EARS specification. " +
  "Automatically infers requirements, classifies EARS patterns, generates acceptance criteria, and identifies clarification questions. " +
  "Supports iterative refinement: pass clarification_responses from a previous run to refine the spec."
);

export function registerTurnkeyTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator,
): void {
  server.registerTool(
    "sdd_turnkey_spec",
    {
      title: "Turnkey Specification from Description",
      description:
        "Generates a complete EARS specification from a natural language feature description. " +
        "Automatically extracts requirements, classifies into EARS patterns (ubiquitous, event-driven, " +
        "state-driven, optional, unwanted), generates acceptance criteria, and identifies areas needing clarification. " +
        "This is the fastest way to go from idea to spec.",
      inputSchema: turnkeySpecInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_name, description, feature_number, spec_dir, force, clarification_responses }) => {
      try {
        const featureSlug = feature_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const featureDir = join(spec_dir, `${feature_number}-${featureSlug}`);

        // If clarification_responses provided, enrich the description with the answers
        let enrichedDescription = description;
        if (clarification_responses && Object.keys(clarification_responses).length > 0) {
          const enrichments = Object.entries(clarification_responses)
            .map(([_qId, answer]) => answer)
            .join(". ");
          enrichedDescription = `${description}. Additional context from clarification: ${enrichments}`;
        }

        // Step 1: Extract requirement candidates from natural language
        const candidates = extractRequirementCandidates(enrichedDescription);

        // Step 2: Convert to EARS notation
        const requirements = candidates.map((candidate, i) => {
          const reqId = `REQ-CORE-${String(i + 1).padStart(3, "0")}`;
          const earsText = convertToEars(candidate);
          const pattern = earsValidator.detectPattern(earsText);
          const validation = earsValidator.validate(earsText);
          const acceptanceCriteria = generateAcceptanceCriteria(candidate, earsText);

          return {
            id: reqId,
            ears_pattern: pattern,
            text: earsText,
            acceptance_criteria: acceptanceCriteria,
            original_text: candidate.text,
            valid: validation.valid,
            issues: validation.issues,
          };
        });

        // Step 3: Generate clarification questions for ambiguous requirements
        const clarifications = generateClarifications(description, requirements);

        // Step 4: Infer non-functional requirements
        const nfrCandidates = inferNonFunctionalRequirements(description);
        const nfrRequirements = nfrCandidates.map((nfr, i) => {
          const reqId = `REQ-NFR-${String(i + 1).padStart(3, "0")}`;
          const earsText = `The system shall ${nfr.text}`;
          return {
            id: reqId,
            ears_pattern: "ubiquitous" as const,
            text: earsText,
            acceptance_criteria: [nfr.criterion],
            original_text: nfr.text,
            valid: true,
            issues: undefined as string[] | undefined,
          };
        });

        const allRequirements = [...requirements, ...nfrRequirements];

        // Step 5: Build SPECIFICATION.md
        const reqSections = allRequirements.map((req) => {
          return [
            `### ${req.id}: (${req.ears_pattern})`,
            "",
            req.text,
            "",
            "**Acceptance Criteria:**",
            ...req.acceptance_criteria.map((ac) => `- ${ac}`),
            "",
            "---",
            "",
          ].join("\n");
        });

        const acTable = allRequirements
          .map((req) => `| ${req.id} | ${req.text.slice(0, 60)}... | Acceptance test |`)
          .join("\n");

        const content = await templateEngine.renderWithFrontmatter("specification", {
          title: `${feature_name} — Specification`,
          feature_id: `${feature_number}-${featureSlug}`,
          project_name: feature_name,
          requirements_core: reqSections.slice(0, requirements.length).join("\n"),
          requirements_functional: "",
          requirements_nonfunctional: reqSections.slice(requirements.length).join("\n"),
          acceptance_criteria_table: acTable,
          ears_compliance: `${allRequirements.filter(r => r.valid).length}/${allRequirements.length}`,
          testability_score: `${allRequirements.length}/${allRequirements.length}`,
          traceability_score: `${allRequirements.length}/${allRequirements.length}`,
          uniqueness_score: `${allRequirements.length}/${allRequirements.length}`,
        });

        // Ensure directory and write file
        await fileManager.ensureSpecDir(spec_dir);
        const filePath = await fileManager.writeSpecFile(featureDir, "SPECIFICATION.md", content, force);

        // Also initialize if needed
        const state = await stateMachine.loadState(spec_dir);
        if (state.current_phase === Phase.Init && state.features.length === 0) {
          // Auto-init
          const constitutionContent = await templateEngine.renderWithFrontmatter("constitution", {
            title: `${feature_name} — Constitution`,
            feature_id: `${feature_number}-${featureSlug}`,
            project_name: feature_name,
            author: "SDD Pipeline (Turnkey)",
            principles: ["Simplicity", "Traceability", "Quality"],
            constraints: ["Derived from natural language description"],
            description: `Foundational charter for ${feature_name}`,
            license: "MIT",
            scope_in: description.slice(0, 200),
            scope_out: "Features not mentioned in the original description",
          });
          await fileManager.writeSpecFile(featureDir, "CONSTITUTION.md", constitutionContent, force);

          const newState = stateMachine.createDefaultState(feature_name);
          newState.features = [featureDir];
          newState.phases[Phase.Init] = { status: "completed", started_at: new Date().toISOString(), completed_at: new Date().toISOString() };
          newState.phases[Phase.Discover] = { status: "completed", started_at: new Date().toISOString(), completed_at: new Date().toISOString() };
          newState.phases[Phase.Specify] = { status: "completed", started_at: new Date().toISOString(), completed_at: new Date().toISOString() };
          newState.current_phase = Phase.Specify;
          await stateMachine.saveState(spec_dir, newState);
        } else {
          await stateMachine.recordPhaseStart(spec_dir, Phase.Specify);
          await stateMachine.recordPhaseComplete(spec_dir, Phase.Specify);
        }

        const validCount = allRequirements.filter(r => r.valid).length;
        const result = {
          status: "turnkey_spec_generated",
          file: filePath,
          total_requirements: allRequirements.length,
          core_requirements: requirements.length,
          nfr_requirements: nfrRequirements.length,
          ears_valid: validCount,
          ears_invalid: allRequirements.length - validCount,
          pattern_distribution: countPatterns(allRequirements),
          clarification_questions: clarifications,
          files_created: state.features.length === 0
            ? ["CONSTITUTION.md", "SPECIFICATION.md", ".sdd-state.json"]
            : ["SPECIFICATION.md"],
          next_steps:
            clarifications.length > 0
              ? `Review ${clarifications.length} clarification questions below. You can: (1) call sdd_turnkey_spec again with clarification_responses to auto-refine, or (2) call sdd_clarify for interactive disambiguation. When satisfied, proceed to sdd_write_design.`
              : "Specification looks complete. Review the generated requirements, then proceed to sdd_write_design.",
          learning_note:
            "Turnkey mode automatically infers EARS patterns from natural language. " +
            "Ubiquitous requirements are always active, event-driven trigger on conditions, " +
            "state-driven apply during states, optional apply to variants, and unwanted handle error cases. " +
            "Review the generated EARS statements — the AI's best guess may need human refinement for edge cases.",
        };

        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_turnkey_spec", error as Error) }],
          isError: true,
        };
      }
    },
  );
}

// ─── Helper Functions ─────────────────────────────────────────────────

export interface RequirementCandidate {
  text: string;
  type: "functional" | "behavior" | "constraint" | "error_handling";
  confidence: number;
}

export function extractRequirementCandidates(description: string): RequirementCandidate[] {
  const candidates: RequirementCandidate[] = [];
  const sentences = description
    .replace(/\n+/g, ". ")
    .split(/[.!;]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    // Skip meta-sentences that aren't requirements
    if (lower.match(/^(for example|e\.g\.|i\.e\.|note:|fyi|btw)/)) continue;

    // Functional: explicit requirement language
    if (lower.match(/\b(must|shall|should|needs? to|has to|will|can|allows?|enables?|provides?|supports?)\b/)) {
      candidates.push({
        text: sentence,
        type: "functional",
        confidence: 0.9,
      });
      continue;
    }

    // Behavior: action/verb-driven
    if (lower.match(/\b(user|admin|system|api|service|app|client|server)\b/) &&
        lower.match(/\b(create|read|update|delete|send|receive|process|validate|authenticate|authorize|display|show|return|store|log|notify|upload|download|search|filter|sort|export|import)\b/)) {
      candidates.push({
        text: sentence,
        type: "behavior",
        confidence: 0.8,
      });
      continue;
    }

    // Constraint: limits and boundaries
    if (lower.match(/\b(maximum|minimum|at least|at most|no more than|within|limit|timeout|latency|response time|must not|cannot|never)\b/)) {
      candidates.push({
        text: sentence,
        type: "constraint",
        confidence: 0.85,
      });
      continue;
    }

    // Error handling
    if (lower.match(/\b(error|fail|invalid|unauthorized|forbidden|timeout|retry|fallback|rollback|recover|exception|crash)\b/)) {
      candidates.push({
        text: sentence,
        type: "error_handling",
        confidence: 0.85,
      });
      continue;
    }

    // Lower confidence: any sentence with a verb that looks like a requirement
    if (lower.match(/\b(the|a|an)\s+\w+\s+(should|will|can|must)\b/) ||
        sentence.match(/^[-*]\s+/) ||
        sentence.match(/^\d+[.)]\s+/)) {
      candidates.push({
        text: sentence.replace(/^[-*\d.)]+\s*/, ""),
        type: "functional",
        confidence: 0.6,
      });
    }
  }

  // Deduplicate similar candidates
  return deduplicateCandidates(candidates);
}

export function deduplicateCandidates(candidates: RequirementCandidate[]): RequirementCandidate[] {
  const unique: RequirementCandidate[] = [];
  for (const candidate of candidates) {
    const isDuplicate = unique.some(u => {
      const overlap = calculateOverlap(u.text.toLowerCase(), candidate.text.toLowerCase());
      return overlap > 0.7;
    });
    if (!isDuplicate) {
      unique.push(candidate);
    }
  }
  return unique;
}

function calculateOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

export function convertToEars(candidate: RequirementCandidate): string {
  const text = candidate.text.replace(/^[-*\d.)]+\s*/, "").trim();
  const lower = text.toLowerCase();

  // Already EARS-compliant?
  if (lower.match(/^(when|while|where|if|the system shall)\b/i)) {
    return text.endsWith(".") ? text : text + ".";
  }

  // Error handling → unwanted (If pattern)
  if (candidate.type === "error_handling" || lower.match(/\b(error|fail|invalid|unauthorized|timeout)\b/)) {
    const condition = extractCondition(text, ["error", "fail", "invalid", "unauthorized", "timeout", "crash"]);
    const action = extractAction(text);
    return `If ${condition}, then the system shall ${action}.`;
  }

  // Event-driven: when something happens
  if (lower.match(/\b(when|after|upon|once|trigger|receives?|submits?|clicks?|requests?)\b/)) {
    const trigger = extractTrigger(text);
    const action = extractAction(text);
    return `When ${trigger}, the system shall ${action}.`;
  }

  // State-driven: while in a state
  if (lower.match(/\b(while|during|as long as|in .+ mode|is (logged|connected|active|running))\b/)) {
    const state = extractState(text);
    const action = extractAction(text);
    return `While ${state}, the system shall ${action}.`;
  }

  // Optional: configuration/feature flag
  if (lower.match(/\b(optional|configur|if enabled|where|feature flag|setting)\b/)) {
    const feature = extractFeature(text);
    const action = extractAction(text);
    return `Where ${feature} is enabled, the system shall ${action}.`;
  }

  // Default to ubiquitous
  const action = extractAction(text);
  return `The system shall ${action}.`;
}

function extractCondition(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword);
    if (idx !== -1) {
      // Take context around the keyword
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + keyword.length + 40);
      const context = text.slice(start, end).trim();
      return context.length > 5 ? `${context} occurs` : `an ${keyword} occurs`;
    }
  }
  return "an unexpected condition occurs";
}

function extractTrigger(text: string): string {
  const lower = text.toLowerCase();
  const triggerWords = ["when", "after", "upon", "once"];
  for (const word of triggerWords) {
    const idx = lower.indexOf(word);
    if (idx !== -1) {
      const after = text.slice(idx + word.length).trim();
      const commaIdx = after.indexOf(",");
      if (commaIdx > 0) return after.slice(0, commaIdx).trim();
      const verbIdx = after.search(/\b(the system|it|shall|should|must|will)\b/i);
      if (verbIdx > 0) return after.slice(0, verbIdx).trim();
      return after.slice(0, 80).trim();
    }
  }
  return "the user performs an action";
}

function extractState(text: string): string {
  const lower = text.toLowerCase();
  const stateWords = ["while", "during", "as long as"];
  for (const word of stateWords) {
    const idx = lower.indexOf(word);
    if (idx !== -1) {
      const after = text.slice(idx + word.length).trim();
      const commaIdx = after.indexOf(",");
      if (commaIdx > 0) return after.slice(0, commaIdx).trim();
      return after.slice(0, 60).trim();
    }
  }
  return "the system is in the specified state";
}

function extractFeature(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("optional")) return "the optional feature";
  if (lower.includes("configur")) return "the configuration option";
  return "the feature";
}

function extractAction(text: string): string {
  let action = text.trim();
  // Remove common prefixes
  const prefixes = [
    /^(the\s+)?(system|server|tool|app|application|api|service)\s+(should|must|will|needs?\s+to|has\s+to|shall|can)\s+/i,
    /^(it|this)\s+(should|must|will|shall|can)\s+/i,
    /^(users?\s+)?(should|must|will|can)\s+(be able to\s+)?/i,
    /^(make|ensure|do|create|implement|add|build|enable|allow|support|provide)\s+/i,
  ];

  for (const prefix of prefixes) {
    action = action.replace(prefix, "");
  }

  // Remove trailing punctuation and clean up
  action = action.replace(/[.!;,]+$/, "").trim();

  // Ensure it starts with a verb
  if (action.length > 0 && !action.match(/^[a-z]/)) {
    action = action.charAt(0).toLowerCase() + action.slice(1);
  }

  return action || "perform the specified action";
}

export function generateAcceptanceCriteria(candidate: RequirementCandidate, earsText: string): string[] {
  const criteria: string[] = [];
  const lower = candidate.text.toLowerCase();

  // Always add a basic criterion
  criteria.push(`Given a valid request, when the feature is invoked, then ${extractAction(candidate.text)} successfully`);

  // Add type-specific criteria
  if (candidate.type === "error_handling") {
    criteria.push("Given an invalid input, the system returns a descriptive error message");
    criteria.push("Given a failure condition, no data is corrupted or lost");
  }

  if (lower.match(/\b(authent|authoriz|login|permission|role|access)\b/)) {
    criteria.push("Given an unauthenticated user, access is denied with HTTP 401");
    criteria.push("Given an unauthorized user, access is denied with HTTP 403");
  }

  if (lower.match(/\b(store|save|persist|database|create|write)\b/)) {
    criteria.push("Given valid data, the record is persisted and retrievable");
  }

  if (lower.match(/\b(search|filter|query|list|find)\b/)) {
    criteria.push("Given matching criteria, relevant results are returned");
    criteria.push("Given no matching criteria, an empty result set is returned");
  }

  if (lower.match(/\b(notif|email|alert|message|send)\b/)) {
    criteria.push("Given a triggering event, the notification is sent to the correct recipient");
  }

  if (lower.match(/\b(upload|download|import|export|file)\b/)) {
    criteria.push("Given a valid file, the operation completes without data loss");
    criteria.push("Given an invalid file format, a descriptive error is returned");
  }

  return criteria;
}

export function generateClarifications(
  description: string,
  requirements: Array<{ id: string; text: string; valid: boolean; issues?: string[] }>,
): Array<{ id: string; question: string; context: string }> {
  const questions: Array<{ id: string; question: string; context: string }> = [];
  const lower = description.toLowerCase();
  let qNum = 1;

  // Check for missing domains
  if (!lower.match(/\b(authent|login|permission|role|security)\b/)) {
    questions.push({
      id: `CQ-${String(qNum++).padStart(3, "0")}`,
      question: "No authentication or authorization requirements were detected. Does this feature require user authentication?",
      context: "Security requirements are often implicit. Clarifying early prevents rework.",
    });
  }

  if (!lower.match(/\b(error|fail|invalid|exception|timeout|retry)\b/)) {
    questions.push({
      id: `CQ-${String(qNum++).padStart(3, "0")}`,
      question: "No error handling scenarios were detected. What should happen when the operation fails?",
      context: "Error paths are the most common source of bugs. Define them early.",
    });
  }

  if (!lower.match(/\b(perform|latency|throughput|concurrent|scale|load|response time)\b/)) {
    questions.push({
      id: `CQ-${String(qNum++).padStart(3, "0")}`,
      question: "No performance requirements were detected. Are there response time or throughput constraints?",
      context: "Performance requirements drive architecture decisions.",
    });
  }

  // Check for invalid EARS requirements
  for (const req of requirements) {
    if (!req.valid && req.issues && qNum <= 5) {
      questions.push({
        id: `CQ-${String(qNum++).padStart(3, "0")}`,
        question: `Requirement ${req.id} has validation issues: ${req.issues.join("; ")}. Can you clarify this requirement?`,
        context: req.text.slice(0, 100),
      });
    }
  }

  return questions.slice(0, 5);
}

export function inferNonFunctionalRequirements(description: string): Array<{ text: string; criterion: string }> {
  const nfrs: Array<{ text: string; criterion: string }> = [];
  const lower = description.toLowerCase();

  // Performance
  if (lower.match(/\b(api|endpoint|request|response|web|server)\b/)) {
    nfrs.push({
      text: "respond to API requests within 500ms at the 95th percentile under normal load",
      criterion: "95% of API requests complete within 500ms under standard load conditions",
    });
  }

  // Logging
  if (lower.match(/\b(create|update|delete|modify|change|write|save)\b/)) {
    nfrs.push({
      text: "log all state-changing operations with timestamp, actor, and action details",
      criterion: "Given any state-changing operation, an audit log entry is created with timestamp, actor ID, and action details",
    });
  }

  // Input validation
  nfrs.push({
    text: "validate all external inputs before processing",
    criterion: "Given malformed or malicious input, the system rejects it with a descriptive error and does not process it",
  });

  return nfrs;
}

export function countPatterns(requirements: Array<{ ears_pattern: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const req of requirements) {
    counts[req.ears_pattern] = (counts[req.ears_pattern] || 0) + 1;
  }
  return counts;
}
