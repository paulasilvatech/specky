import { z } from "zod";
import { workloadDesignInputSchema } from "../contracts/pipeline-profiles.js";

export const constitutionContentSchema = z.object({
    author: z.string().min(3),
    description: z.string().min(10),
    license: z.string().min(2),
    scope_in: z.string().min(5),
    scope_out: z.string().min(5),
    principles: z.array(z.string().min(5)).min(1),
    constraints: z.array(z.string().min(5)).min(1),
}).strict();

export const requirementContentSchema = z.object({
    id: z.string().regex(/^REQ-[A-Z]+-\d{3}$/),
    title: z.string().min(3).max(120),
    ears_pattern: z.enum(["ubiquitous", "event_driven", "state_driven", "optional", "unwanted", "complex"]),
    text: z.string().min(10),
    acceptance_criteria: z.array(z.string().min(5)).min(1),
    source_quote: z.string().min(5),
}).strict();

export const architectureContentSchema = z.object({
    architecture_overview: z.string().min(10),
    system_context: z.string().min(10),
    container_architecture: z.string().min(10),
    component_design: z.string().min(10),
    code_level_design: z.string().min(10),
    data_models: z.string().min(10),
    infrastructure: z.string().min(10),
    security_architecture: z.string().min(10),
    error_handling: z.string().min(10),
    cross_cutting: z.string().min(10),
    workload_design: workloadDesignInputSchema,
    mermaid_diagrams: z.array(z.object({
        title: z.string().min(3),
        type: z.string().min(3),
        code: z.string().min(10),
    }).strict()).min(1),
    adrs: z.array(z.object({
        title: z.string().min(3),
        decision: z.string().min(10),
        rationale: z.string().min(10),
        consequences: z.string().min(10),
    }).strict()).min(1),
    api_contracts: z.array(z.object({
        endpoint: z.string().min(1),
        method: z.string().min(3),
        description: z.string().min(10),
        request: z.string().min(2),
        response: z.string().min(2),
    }).strict()),
}).strict();

export const taskContentSchema = z.object({
    id: z.string().regex(/^T-\d{3}$/),
    title: z.string().min(3),
    description: z.string().min(10),
    effort: z.enum(["S", "M", "L"]),
    dependencies: z.array(z.string().regex(/^T-\d{3}$/)),
    parallel: z.boolean(),
    traces_to: z.array(z.string().regex(/^REQ-[A-Z]+-\d{3}$/)).min(1),
}).strict();

export const preImplementationGateSchema = z.object({
    id: z.string().min(1),
    check: z.string().min(10),
    constitution_article: z.string().min(3),
}).strict();
