/**
 * Infrastructure as Code Schemas — sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile.
 */

import { z } from "zod";
import { specDirSchema, featureNumberSchema } from "./common.js";

const cloudProviderEnum = z
  .enum(["azure", "aws", "gcp"])
  .default("azure")
  .describe("Target cloud provider");

const iacProviderEnum = z
  .enum(["terraform", "bicep"])
  .default("terraform")
  .describe("IaC provider to use");

export const generateIacInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  provider: iacProviderEnum,
  cloud: cloudProviderEnum,
  modules: z
    .array(z.string().min(1))
    .optional()
    .describe("Specific infrastructure modules to generate (e.g., 'networking', 'compute', 'database'). If omitted, generates all detected from DESIGN.md"),
}).strict().describe("Generate Infrastructure as Code from DESIGN.md. Produces Terraform or Bicep files based on the architecture design.");

export const validateIacInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  provider: iacProviderEnum,
  cloud: cloudProviderEnum,
  iac_dir: z
    .string()
    .min(1)
    .optional()
    .describe("Directory containing IaC files to validate. Defaults to feature directory"),
}).strict().describe("Output a validation payload for Terraform MCP (plan/validate) and Azure MCP (template validation). The AI client routes this to the appropriate MCP server.");

export const generateDockerfileInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
  include_compose: z
    .boolean()
    .default(true)
    .describe("Also generate docker-compose.yml alongside Dockerfile"),
  multi_stage: z
    .boolean()
    .default(true)
    .describe("Use multi-stage build for smaller production images"),
}).strict().describe("Generate Dockerfile and docker-compose.yml from DESIGN.md tech stack detection.");
