/**
 * Checkpoint Tools — sdd_checkpoint, sdd_restore.
 * Snapshot and rollback spec artifacts.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { z } from "zod";
import { CHARACTER_LIMIT } from "../constants.js";
import type { FileManager } from "../services/file-manager.js";
import type { StateMachine } from "../services/state-machine.js";
import { enrichResponse } from "./response-builder.js";

function formatError(toolName: string, error: Error): string {
  return `[${toolName}] Error: ${error.message}`;
}

const checkpointInputSchema = z.object({
  feature_number: z
    .string()
    .regex(/^\d{3}$/, "Feature number must be 3 digits")
    .default("001")
    .describe("Feature number (e.g. '001')"),
  spec_dir: z.string().default(".specs").describe("Spec directory path"),
  label: z
    .string()
    .max(100)
    .optional()
    .describe("Human-readable label for this checkpoint (e.g. 'before-redesign', 'v1-approved')"),
}).strict().describe("Create a named snapshot of all spec artifacts for the feature. Allows rollback to this point later.");

const restoreInputSchema = z.object({
  feature_number: z
    .string()
    .regex(/^\d{3}$/, "Feature number must be 3 digits")
    .default("001")
    .describe("Feature number (e.g. '001')"),
  spec_dir: z.string().default(".specs").describe("Spec directory path"),
  checkpoint_id: z
    .string()
    .min(1)
    .describe("Checkpoint ID to restore (e.g. 'CP-001' or the label)"),
}).strict().describe("Restore spec artifacts from a previous checkpoint. Overwrites current artifacts with the checkpoint snapshot.");

const listCheckpointsInputSchema = z.object({
  feature_number: z
    .string()
    .regex(/^\d{3}$/, "Feature number must be 3 digits")
    .default("001")
    .describe("Feature number (e.g. '001')"),
  spec_dir: z.string().default(".specs").describe("Spec directory path"),
}).strict().describe("List all available checkpoints for a feature.");

export function registerCheckpointTools(
  server: McpServer,
  fileManager: FileManager,
  stateMachine: StateMachine,
): void {
  // ─── sdd_checkpoint ───
  server.registerTool(
    "sdd_checkpoint",
    {
      title: "Create Checkpoint",
      description:
        "Creates a named snapshot of all spec artifacts (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, etc.) " +
        "and the current pipeline state. Use before making major changes so you can rollback if needed.",
      inputSchema: checkpointInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, label }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}. Run sdd_init first.`);
        }

        // Load current state
        const state = await stateMachine.loadState(spec_dir);

        // Determine checkpoint number
        const checkpointsDir = join(feature.directory, ".checkpoints");
        let existingCheckpoints: string[] = [];
        try {
          const checkpointFiles = await fileManager.listSpecFiles(checkpointsDir);
          existingCheckpoints = checkpointFiles.filter(f => f.endsWith(".json"));
        } catch {
          // Directory doesn't exist yet, that's fine
        }
        const cpNumber = existingCheckpoints.length + 1;
        const cpId = `CP-${String(cpNumber).padStart(3, "0")}`;

        // Snapshot all artifacts
        const artifactNames = [
          "CONSTITUTION.md", "SPECIFICATION.md", "DESIGN.md", "TASKS.md",
          "ANALYSIS.md", "CHECKLIST.md", "VERIFICATION.md", "BUGFIX_SPEC.md",
          "COMPLIANCE.md", "CROSS_ANALYSIS.md",
        ];

        const artifacts: Record<string, string> = {};
        for (const name of artifactNames) {
          try {
            const content = await fileManager.readSpecFile(feature.directory, name);
            artifacts[name] = content;
          } catch {
            // File doesn't exist, skip
          }
        }

        // Build checkpoint payload
        const checkpoint = {
          id: cpId,
          label: label || `Checkpoint ${cpNumber}`,
          created_at: new Date().toISOString(),
          phase: state.current_phase,
          phases: state.phases,
          gate_decision: state.gate_decision,
          artifacts: Object.keys(artifacts),
          artifact_contents: artifacts,
        };

        // Write checkpoint file
        await fileManager.writeSpecFile(
          checkpointsDir,
          `${cpId}.json`,
          JSON.stringify(checkpoint, null, 2),
          true,
        );

        const result = {
          status: "checkpoint_created",
          checkpoint_id: cpId,
          label: checkpoint.label,
          phase: state.current_phase,
          artifacts_saved: Object.keys(artifacts),
          created_at: checkpoint.created_at,
          next_steps: `Checkpoint ${cpId} saved. You can restore to this point with sdd_restore(checkpoint_id: "${cpId}"). Continue making changes safely.`,
          learning_note: "Checkpoints are snapshots of your spec artifacts at a specific point in time. " +
            "Create checkpoints before major changes (redesigns, scope changes) so you can rollback if the new direction doesn't work out. " +
            "Each checkpoint stores the full content of all artifacts plus the pipeline state.",
        };

        const enriched = await enrichResponse("sdd_checkpoint", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_checkpoint", error as Error) }],
          isError: true,
        };
      }
    },
  );

  // ─── sdd_restore ───
  server.registerTool(
    "sdd_restore",
    {
      title: "Restore from Checkpoint",
      description:
        "Restores all spec artifacts to a previous checkpoint snapshot. " +
        "Overwrites current files with the checkpoint versions. Creates an automatic backup checkpoint of current state before restoring.",
      inputSchema: restoreInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir, checkpoint_id }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}.`);
        }

        const checkpointsDir = join(feature.directory, ".checkpoints");

        // Find checkpoint by ID or label
        let checkpointContent: string;
        try {
          // Try direct ID match
          checkpointContent = await fileManager.readSpecFile(checkpointsDir, `${checkpoint_id}.json`);
        } catch {
          // Try finding by label
          const files = await fileManager.listSpecFiles(checkpointsDir);
          let found = false;
          for (const file of files) {
            if (!file.endsWith(".json")) continue;
            const content = await fileManager.readSpecFile(checkpointsDir, file);
            const cp = JSON.parse(content);
            if (cp.label === checkpoint_id || cp.id === checkpoint_id) {
              checkpointContent = content;
              found = true;
              break;
            }
          }
          if (!found) {
            throw new Error(`Checkpoint "${checkpoint_id}" not found. Use sdd_list_checkpoints to see available checkpoints.`);
          }
        }

        const checkpoint = JSON.parse(checkpointContent!);

        // Auto-backup current state before restoring
        const backupArtifacts: Record<string, string> = {};
        for (const name of Object.keys(checkpoint.artifact_contents)) {
          try {
            const current = await fileManager.readSpecFile(feature.directory, name);
            backupArtifacts[name] = current;
          } catch {
            // Current file doesn't exist
          }
        }

        const state = await stateMachine.loadState(spec_dir);
        const autoBackup = {
          id: "CP-AUTO-BACKUP",
          label: `Auto-backup before restoring ${checkpoint.id}`,
          created_at: new Date().toISOString(),
          phase: state.current_phase,
          phases: state.phases,
          gate_decision: state.gate_decision,
          artifacts: Object.keys(backupArtifacts),
          artifact_contents: backupArtifacts,
        };
        await fileManager.writeSpecFile(
          checkpointsDir,
          "CP-AUTO-BACKUP.json",
          JSON.stringify(autoBackup, null, 2),
          true,
        );

        // Restore artifacts
        const restored: string[] = [];
        for (const [name, content] of Object.entries(checkpoint.artifact_contents as Record<string, string>)) {
          await fileManager.writeSpecFile(feature.directory, name, content, true);
          restored.push(name);
        }

        // Restore pipeline state
        if (checkpoint.phases) {
          state.current_phase = checkpoint.phase;
          state.phases = checkpoint.phases;
          state.gate_decision = checkpoint.gate_decision || null;
          await stateMachine.saveState(spec_dir, state);
        }

        const result = {
          status: "checkpoint_restored",
          checkpoint_id: checkpoint.id,
          checkpoint_label: checkpoint.label,
          restored_phase: checkpoint.phase,
          restored_artifacts: restored,
          auto_backup: "CP-AUTO-BACKUP",
          next_steps: `Restored to ${checkpoint.id} ("${checkpoint.label}"). Current state before restore was saved as CP-AUTO-BACKUP. Review the restored artifacts and continue from the ${checkpoint.phase} phase.`,
          learning_note: "The restore operation creates an automatic backup of your current state before overwriting. " +
            "This means you can always undo a restore by running sdd_restore(checkpoint_id: 'CP-AUTO-BACKUP').",
        };

        const enriched = await enrichResponse("sdd_restore", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_restore", error as Error) }],
          isError: true,
        };
      }
    },
  );

  // ─── sdd_list_checkpoints ───
  server.registerTool(
    "sdd_list_checkpoints",
    {
      title: "List Checkpoints",
      description: "Lists all available checkpoints for a feature with their labels, dates, and phases.",
      inputSchema: listCheckpointsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ feature_number, spec_dir }) => {
      try {
        const features = await fileManager.listFeatures(spec_dir);
        const feature = features.find((f) => f.number === feature_number);
        if (!feature) {
          throw new Error(`Feature ${feature_number} not found in ${spec_dir}.`);
        }

        const checkpointsDir = join(feature.directory, ".checkpoints");
        let files: string[];
        try {
          files = await fileManager.listSpecFiles(checkpointsDir);
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "no_checkpoints",
                checkpoints: [],
                next_steps: "No checkpoints found. Use sdd_checkpoint to create one before making major changes.",
              }, null, 2),
            }],
          };
        }

        const checkpoints: Array<{
          id: string;
          label: string;
          created_at: string;
          phase: string;
          artifacts: string[];
        }> = [];

        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const content = await fileManager.readSpecFile(checkpointsDir, file);
            const cp = JSON.parse(content);
            checkpoints.push({
              id: cp.id,
              label: cp.label,
              created_at: cp.created_at,
              phase: cp.phase,
              artifacts: cp.artifacts || [],
            });
          } catch {
            // Skip corrupted checkpoint files
          }
        }

        // Sort by creation date (newest first)
        checkpoints.sort((a, b) => b.created_at.localeCompare(a.created_at));

        const result = {
          status: "checkpoints_listed",
          total: checkpoints.length,
          checkpoints,
          next_steps: checkpoints.length > 0
            ? `Use sdd_restore(checkpoint_id: "${checkpoints[0].id}") to restore to any checkpoint.`
            : "No checkpoints yet. Use sdd_checkpoint to create one.",
        };

        const enriched = await enrichResponse("sdd_list_checkpoints", result, stateMachine, spec_dir);
        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError("sdd_list_checkpoints", error as Error) }],
          isError: true,
        };
      }
    },
  );
}
