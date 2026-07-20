/**
 * Dev Environment Schemas — sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer.
 */

import { z } from "zod";
import { featureNumberSchema, specDirSchema } from "./common.js";

export const setupLocalEnvInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
  })
  .strict()
  .describe(
    "Output a Docker MCP payload for creating a local development environment. The AI client routes this to Docker MCP's compose tools.",
  );

export const setupCodespacesInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
  })
  .strict()
  .describe(
    "Output a GitHub MCP payload for creating a Codespaces environment. The AI client routes this to GitHub MCP.",
  );

export const generateDevcontainerInputSchema = z
  .object({
    feature_number: featureNumberSchema,
    spec_dir: specDirSchema,
  })
  .strict()
  .describe(
    "Generate .devcontainer/devcontainer.json from DESIGN.md tech stack. Includes appropriate base image, features, extensions, and port forwarding.",
  );
