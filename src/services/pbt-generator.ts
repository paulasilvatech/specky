import type { FileManager } from "./file-manager.js";
import { currentDateString } from "../utils/runtime-context.js";
import { extractRequirementIds } from "../utils/id-contracts.js";

export type PbtFramework = "fast-check" | "hypothesis";

export type PbtPropertyType =
    | "invariant"
    | "state_transition"
    | "conditional"
    | "negative"
    | "round_trip"
    | "idempotence"
    | "commutativity"
    | "monotonicity";

export interface PropertyBinding {
    requirement_id: string;
    property_name: string;
    property_type: PbtPropertyType;
    body: string;
}

export interface PbtProperty {
    id: string;
    requirement_id: string;
    property_type: PbtPropertyType;
    description: string;
    test_code: string;
}

export interface PbtGenerationResult {
    framework: PbtFramework;
    properties: PbtProperty[];
    output_file: string;
    content: string;
    total_properties: number;
    property_types: Record<string, number>;
}

const FRAMEWORK_CONFIG: Record<PbtFramework, { extension: string; commentPrefix: string }> = {
    "fast-check": { extension: ".pbt.test.ts", commentPrefix: "//" },
    hypothesis: { extension: "_pbt_test.py", commentPrefix: "#" },
};

export class PbtGenerator {
    constructor(private readonly fileManager: FileManager) { }

    async generate(
        featureDir: string,
        framework: PbtFramework,
        outputDir: string,
        imports: string,
        bindings: PropertyBinding[],
    ): Promise<PbtGenerationResult> {
        const spec = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
        const requirementIds = extractRequirementIds(spec);
        this.validateBindings(requirementIds, bindings);

        const properties = bindings.map((binding, index) => ({
            id: `PROP-${String(index + 1).padStart(3, "0")}`,
            requirement_id: binding.requirement_id,
            property_type: binding.property_type,
            description: binding.property_name,
            test_code: binding.body,
        }));
        const featureName = featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9-]/g, "");
        const frameworkConfig = FRAMEWORK_CONFIG[framework];
        const outputFile = `${outputDir}/${featureName}${frameworkConfig.extension}`;
        const content = this.renderFile(properties, framework, featureName, imports);
        const propertyTypes: Record<string, number> = {};
        for (const property of properties) {
            propertyTypes[property.property_type] = (propertyTypes[property.property_type] ?? 0) + 1;
        }

        return {
            framework,
            properties,
            output_file: outputFile,
            content,
            total_properties: properties.length,
            property_types: propertyTypes,
        };
    }

    private validateBindings(requirementIds: string[], bindings: PropertyBinding[]): void {
        if (requirementIds.length === 0) {
            throw new Error("SPECIFICATION.md contains no requirement IDs for property traceability.");
        }
        const expected = new Set(requirementIds);
        const covered = new Set(bindings.map((binding) => binding.requirement_id));
        const missing = requirementIds.filter((id) => !covered.has(id));
        const unknown = [...covered].filter((id) => !expected.has(id));
        if (missing.length > 0 || unknown.length > 0) {
            throw new Error(`Property bindings mismatch. Missing: ${missing.join(", ") || "none"}. Unknown: ${unknown.join(", ") || "none"}.`);
        }

        for (const binding of bindings) {
            if (!binding.body.includes(binding.requirement_id)) {
                throw new Error(`Property binding ${binding.requirement_id} must include its requirement ID.`);
            }
            if (/(?:\/\/|#|\/\*|\[)\s*TODO\b|return\s+true\b|assert\s+True\b/i.test(binding.body)) {
                throw new Error(`Property binding ${binding.requirement_id} contains a placeholder or trivial property.`);
            }
        }
    }

    private renderFile(
        properties: PbtProperty[],
        framework: PbtFramework,
        featureName: string,
        imports: string,
    ): string {
        const config = FRAMEWORK_CONFIG[framework];
        const header = [
            `${config.commentPrefix} Executable property tests from explicit Specky TDD bindings`,
            `${config.commentPrefix} Feature: ${featureName}`,
            `${config.commentPrefix} Framework: ${framework}`,
            `${config.commentPrefix} Generated: ${currentDateString()}`,
            `${config.commentPrefix} Every property body is supplied by the feature contract.`,
        ].join("\n");
        return `${header}\n\n${imports}\n\n${properties.map((property) => property.test_code).join("\n\n")}\n`;
    }
}
