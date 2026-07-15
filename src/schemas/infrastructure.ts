/**
 * Infrastructure as Code Schemas — sdd_generate_iac, sdd_validate_iac, sdd_generate_dockerfile.
 */

import { specDirSchema, featureNumberSchema } from "./common.js";
import { z } from "zod";

export const generateIacInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate Infrastructure as Code from DESIGN.md. Produces Terraform or Bicep files based on the architecture design.");

export const validateIacInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Output a validation payload for Terraform MCP (plan/validate) and Azure MCP (template validation). The AI client routes this to the appropriate MCP server.");

export const generateDockerfileInputSchema = z.object({
  feature_number: featureNumberSchema,
  spec_dir: specDirSchema,
}).strict().describe("Generate Dockerfile and docker-compose.yml from DESIGN.md tech stack detection.");
