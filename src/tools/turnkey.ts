import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Phase, TOOL_NAMES } from "../constants.js";
import { featureNumberSchema, forceSchema, specDirSchema } from "../schemas/common.js";
import type { EarsValidator } from "../services/ears-validator.js";
import { requireExecutionContext } from "../services/execution-context.js";
import { FeaturePackageGenerator } from "../services/feature-package-generator.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import type { TemplateEngine } from "../services/template-engine.js";
import { artifactMetadata } from "../utils/artifact-metadata.js";
import { enrichResponse } from "./response-builder.js";
import { errorResult, truncate } from "./tool-result.js";

const explicitRequirementSchema = z
  .object({
    id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
    ears_pattern: z.enum([
      "ubiquitous",
      "event_driven",
      "state_driven",
      "optional",
      "unwanted",
      "complex",
    ]),
    title: z.string().min(3),
    text: z.string().min(10),
    acceptance_criteria: z.array(z.string().min(5)).min(1),
    source_evidence: z.string().min(5),
  })
  .strict();

const turnkeySpecInputSchema = z
  .object({
    feature_name: z.string().min(1).max(200),
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
    force: forceSchema,
    discovery_context: z.string().min(20),
    clarification_responses: z.record(z.string().min(1), z.string().min(3)),
    requirements: z.array(explicitRequirementSchema).min(1),
  })
  .strict()
  .describe(
    "Assemble a specification for an initialized feature from explicit EARS requirements, evidence, and clarification responses. No requirements or criteria are inferred.",
  );

type ExplicitRequirement = z.infer<typeof explicitRequirementSchema>;

function renderRequirement(requirement: ExplicitRequirement): string {
  return [
    `### ${requirement.id}: ${requirement.title} (${requirement.ears_pattern})`,
    "",
    requirement.text,
    "",
    "**Acceptance Criteria:**",
    ...requirement.acceptance_criteria.map((criterion) => `- ${criterion}`),
    "",
    `**Source Evidence:** ${requirement.source_evidence}`,
    "",
    "---",
  ].join("\n");
}

function assertRequirements(
  requirements: ExplicitRequirement[],
  earsValidator: EarsValidator,
): void {
  const ids = requirements.map((requirement) => requirement.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Turnkey requirements must use unique requirement IDs.");
  }
  for (const requirement of requirements) {
    const detected = earsValidator.detectPattern(requirement.text);
    const validation = earsValidator.validate(requirement.text);
    if (!validation.valid) {
      throw new Error(
        `${requirement.id} is not EARS compliant: ${(validation.issues ?? []).join("; ")}.`,
      );
    }
    if (detected !== requirement.ears_pattern) {
      throw new Error(
        `${requirement.id} declares ${requirement.ears_pattern} but the validator detects ${detected}.`,
      );
    }
  }
}

export function registerTurnkeyTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
  templateEngine: TemplateEngine,
  earsValidator: EarsValidator,
): void {
  const featurePackageGenerator = new FeaturePackageGenerator(fileManager);

  server.registerTool(
    TOOL_NAMES.TURNKEY_SPEC,
    {
      title: "Assemble Explicit Turnkey Specification",
      description:
        "Validates and assembles caller-provided EARS requirements, acceptance criteria, source evidence, discovery context, and clarification responses for an initialized feature. It performs no requirement inference.",
      inputSchema: turnkeySpecInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_name, force, discovery_context, clarification_responses, requirements }) => {
      try {
        const context = requireExecutionContext(TOOL_NAMES.TURNKEY_SPEC);
        const feature = context.feature!;
        const stateDir = context.stateDir!;
        if (feature.name !== feature_name) {
          throw new Error(
            `feature_name ${feature_name} does not match initialized feature ${feature.name}.`,
          );
        }
        assertRequirements(requirements, earsValidator);

        const requirementSections = requirements.map(renderRequirement).join("\n\n");
        const acceptanceTable = requirements
          .map(
            (requirement) =>
              `| ${requirement.id} | ${requirement.title} | ${requirement.acceptance_criteria.join("; ")} |`,
          )
          .join("\n");
        const clarificationEvidence = Object.entries(clarification_responses)
          .map(([question, answer]) => `- **${question}:** ${answer}`)
          .join("\n");
        const content = await templateEngine.renderWithFrontmatter("specification", {
          ...artifactMetadata({
            version: "1.0.0",
            author: TOOL_NAMES.TURNKEY_SPEC,
            status: "Draft",
          }),
          title: `${feature.name} — Specification`,
          feature_id: `${feature.number}-${feature.name}`,
          project_name: feature.name,
          discovery_context: [
            "## Discovery Context",
            "",
            discovery_context,
            "",
            "### Clarification Evidence",
            "",
            clarificationEvidence || "- No clarification responses were required.",
            "",
            "---",
          ].join("\n"),
          requirements_core: requirementSections,
          requirements_functional: "",
          requirements_nonfunctional: "",
          acceptance_criteria_table: acceptanceTable,
          ears_compliance: `${requirements.length}/${requirements.length}`,
          testability_score: `${requirements.length}/${requirements.length}`,
          traceability_score: `${requirements.length}/${requirements.length}`,
          uniqueness_score: `${requirements.length}/${requirements.length}`,
        });

        const filePath = await fileManager.writeSpecFile(
          feature.directory,
          "SPECIFICATION.md",
          content,
          force,
        );
        const featurePackage = await featurePackageGenerator.ensureFeaturePackage({
          featureDir: feature.directory,
          featureNumber: feature.number,
          featureName: feature.name,
          specContent: content,
          sourceTool: TOOL_NAMES.TURNKEY_SPEC,
        });
        await stateMachine.ensurePhasesThrough(stateDir, Phase.Specify);
        await stateMachine.recordPhaseStart(stateDir, Phase.Specify);
        await stateMachine.recordPhaseComplete(stateDir, Phase.Specify);

        const result = await enrichResponse(
          TOOL_NAMES.TURNKEY_SPEC,
          {
            status: "explicit_turnkey_specification_written",
            file: filePath,
            requirement_count: requirements.length,
            clarification_count: Object.keys(clarification_responses).length,
            feature_package: featurePackage,
            contract_id: context.state!.contract.id,
          },
          stateMachine,
          stateDir,
          {
            completedPhase: Phase.Specify,
            nextPhase: context.state!.contract.phases.includes(Phase.Clarify)
              ? Phase.Clarify
              : Phase.Design,
            artifactsProduced: ["SPECIFICATION.md", ...featurePackage.created],
          },
        );
        return {
          content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
        };
      } catch (error) {
        return errorResult(TOOL_NAMES.TURNKEY_SPEC, error);
      }
    },
  );
}
