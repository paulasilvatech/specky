/**
 * Dev Environment Schemas — sdd_setup_local_env, sdd_setup_codespaces, sdd_generate_devcontainer.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

export const setupLocalEnvInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  services: z
    .array(z.string().min(1))
    .optional()
    .describe("Additional services to include (e.g., 'postgres', 'redis', 'rabbitmq'). Auto-detected from DESIGN.md if omitted."),
  port: z
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(3000)
    .describe("Primary application port to expose."),
}).strict().describe("Output a Docker MCP payload for creating a local development environment. The AI client routes this to Docker MCP's compose tools.");

export const setupCodespacesInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  machine_type: z
    .enum(["basicLinux32gb", "standardLinux32gb", "premiumLinux", "largePremiumLinux"])
    .default("standardLinux32gb")
    .describe("GitHub Codespaces machine type."),
  extensions: z
    .array(z.string().min(1))
    .optional()
    .describe("VS Code extensions to install. Auto-detected from tech stack if omitted."),
}).strict().describe("Output a GitHub MCP payload for creating a Codespaces environment. The AI client routes this to GitHub MCP.");

export const generateDevcontainerInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  base_image: z
    .string()
    .optional()
    .describe("Base Docker image for the devcontainer. Auto-detected from tech stack if omitted."),
  features: z
    .array(z.string().min(1))
    .optional()
    .describe("Devcontainer features to include (e.g., 'ghcr.io/devcontainers/features/node:1')."),
}).strict().describe("Generate .devcontainer/devcontainer.json from DESIGN.md tech stack. Includes appropriate base image, features, extensions, and port forwarding.");
