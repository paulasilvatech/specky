/**
 * PbtGenerator — Generates property-based tests from SPECIFICATION.md.
 * Reads EARS requirements and produces framework-specific PBT files
 * for fast-check (TypeScript) or hypothesis (Python).
 */
import type { FileManager } from "./file-manager.js";

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

const FRAMEWORK_CONFIG: Record<PbtFramework, { ext: string }> = {
  "fast-check": { ext: ".pbt.test.ts" },
  hypothesis: { ext: "_pbt_test.py" },
};

export class PbtGenerator {
  constructor(private fileManager: FileManager) {}

  async generate(
    featureDir: string,
    framework: PbtFramework,
    outputDir: string,
  ): Promise<PbtGenerationResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");

    const requirements = this.extractEarsRequirements(spec);
    const properties = this.buildProperties(requirements, framework, featureDir);
    const content = this.renderFile(properties, framework, featureDir);
    const featureName = featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9-]/g, "");
    const cfg = FRAMEWORK_CONFIG[framework];
    const outputFile = `${outputDir}/${featureName}${cfg.ext}`;

    const propertyTypes: Record<string, number> = {};
    for (const prop of properties) {
      propertyTypes[prop.property_type] = (propertyTypes[prop.property_type] || 0) + 1;
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

  extractEarsRequirements(text: string): Array<{ line: string; reqId: string }> {
    const results: Array<{ line: string; reqId: string }> = [];
    const lines = text.split("\n");

    for (const line of lines) {
      if (/^(When|While|Where|If|The)\s+.+shall\s+/im.test(line)) {
        const reqMatch = line.match(/REQ-[A-Z]+-\d{3}/);
        const reqId = reqMatch ? reqMatch[0] : `REQ-GEN-${String(results.length + 1).padStart(3, "0")}`;
        results.push({ line: line.trim(), reqId });
      }
    }

    return results;
  }

  classifyPropertyType(line: string): PbtPropertyType {
    const lower = line.toLowerCase();

    // Detect special patterns first
    if (
      lower.includes("parse") &&
      (lower.includes("serialize") ||
        lower.includes("format") ||
        lower.includes("render") ||
        lower.includes("print") ||
        lower.includes("export"))
    ) {
      return "round_trip";
    }

    if (
      lower.includes("convert") ||
      lower.includes("transform") ||
      lower.includes("encode") ||
      lower.includes("decode")
    ) {
      return "round_trip";
    }

    // Commutativity: order-independent operations
    if (
      lower.includes("regardless of order") ||
      lower.includes("commutativ") ||
      lower.includes("interchangeabl") ||
      (lower.includes("order") && (lower.includes("swap") || lower.includes("independen"))) ||
      (lower.includes("combine") && lower.includes("order"))
    ) {
      return "commutativity";
    }

    // Monotonicity: proportional/scaling relationships
    if (
      lower.includes("monoton") ||
      lower.includes("proportional") ||
      (lower.includes("increase") && lower.includes("increase")) ||
      (lower.includes("more") && lower.includes("more")) ||
      (lower.includes("larger") && lower.includes("larger")) ||
      (lower.includes("grow") && lower.includes("scale"))
    ) {
      return "monotonicity";
    }

    if (
      lower.includes("delete") ||
      lower.includes("remove") ||
      lower.includes("reset") ||
      lower.includes("apply") ||
      lower.includes("update")
    ) {
      return "idempotence";
    }

    // Classify by EARS pattern
    if (/^the\s+system\s+shall\b/i.test(line)) {
      return "invariant";
    }
    if (/^when\b/i.test(line)) {
      return "state_transition";
    }
    if (/^while\b/i.test(line)) {
      return "conditional";
    }
    if (/^if\b/i.test(line)) {
      return "negative";
    }
    if (/^where\b/i.test(line)) {
      return "conditional";
    }

    return "invariant";
  }

  private buildProperties(
    requirements: Array<{ line: string; reqId: string }>,
    framework: PbtFramework,
    featureDir: string,
  ): PbtProperty[] {
    return requirements.map((req, i) => {
      const propId = `PROP-${String(i + 1).padStart(3, "0")}`;
      const propertyType = this.classifyPropertyType(req.line);
      const description =
        req.line.length > 100 ? req.line.slice(0, 97) + "..." : req.line;
      const testCode = this.generateTestCode(propId, description, req.line, propertyType, framework, featureDir);
      return {
        id: propId,
        requirement_id: req.reqId,
        property_type: propertyType,
        description,
        test_code: testCode,
      };
    });
  }

  private generateTestCode(
    propId: string,
    description: string,
    requirementText: string,
    propertyType: PbtPropertyType,
    framework: PbtFramework,
    _featureDir: string,
  ): string {
    const safeDesc = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    if (framework === "fast-check") {
      return this.generateFastCheckTest(propId, safeDesc, requirementText, propertyType);
    }
    return this.generateHypothesisTest(propId, safeDesc, requirementText, propertyType);
  }

  private generateFastCheckTest(
    propId: string,
    description: string,
    requirementText: string,
    propertyType: PbtPropertyType,
  ): string {
    const safeReq = requirementText.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    switch (propertyType) {
      case "invariant":
        return [
          `  it("${propId}: ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.string(), fc.integer(), (input1, input2) => {`,
          `        // TODO: Replace with actual system call`,
          `        // Property: ${safeReq}`,
          `        const result = systemUnderTest(input1, input2);`,
          `        expect(result).toBeDefined();`,
          `        return true; // Replace with actual invariant check`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "round_trip":
        return [
          `  it("${propId}: round-trip — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.jsonValue(), (input) => {`,
          `        // TODO: Verify round-trip: parse(serialize(x)) === x`,
          `        const serialized = serialize(input);`,
          `        const parsed = parse(serialized);`,
          `        expect(parsed).toEqual(input);`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "idempotence":
        return [
          `  it("${propId}: idempotence — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.anything(), (input) => {`,
          `        // TODO: Verify f(f(x)) === f(x)`,
          `        const once = operation(input);`,
          `        const twice = operation(once);`,
          `        expect(twice).toEqual(once);`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "state_transition":
        return [
          `  it("${propId}: state transition — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.record({ event: fc.string(), state: fc.string() }), ({ event, state }) => {`,
          `        // TODO: Verify state transition is valid`,
          `        const newState = transition(state, event);`,
          `        expect(newState).toBeDefined();`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "negative":
        return [
          `  it("${propId}: negative — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.string(), (maliciousInput) => {`,
          `        // TODO: Verify unwanted behavior never occurs`,
          `        const result = systemUnderTest(maliciousInput);`,
          `        expect(result.error).not.toContain("crash");`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "conditional":
        return [
          `  it("${propId}: conditional — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.boolean(), fc.anything(), (condition, input) => {`,
          `        // TODO: Verify behavior only when condition holds`,
          `        fc.pre(condition); // Only test when condition is true`,
          `        const result = systemUnderTest(input);`,
          `        expect(result).toBeDefined();`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "commutativity":
        return [
          `  it("${propId}: commutativity — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.string(), fc.string(), (a, b) => {`,
          `        // TODO: Verify f(a, b) === f(b, a)`,
          `        expect(operation(a, b)).toEqual(operation(b, a));`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");

      case "monotonicity":
        return [
          `  it("${propId}: monotonicity — ${description}", () => {`,
          `    fc.assert(`,
          `      fc.property(fc.integer(), fc.integer(), (x, y) => {`,
          `        // TODO: Verify x <= y implies f(x) <= f(y)`,
          `        fc.pre(x <= y);`,
          `        expect(f(x)).toBeLessThanOrEqual(f(y));`,
          `        return true;`,
          `      }),`,
          `      { numRuns: 100 }`,
          `    );`,
          `  });`,
        ].join("\n");
    }
  }

  private generateHypothesisTest(
    propId: string,
    description: string,
    requirementText: string,
    propertyType: PbtPropertyType,
  ): string {
    const descSnake = this.snakeCase(description);

    switch (propertyType) {
      case "invariant":
        return [
          `    @given(input1=st.text(), input2=st.integers())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_${descSnake}(self, input1, input2):`,
          `        """${propId}: ${requirementText}"""`,
          `        # TODO: Replace with actual system call`,
          `        result = system_under_test(input1, input2)`,
          `        assert result is not None`,
        ].join("\n");

      case "round_trip":
        return [
          `    @given(data=st.from_type(dict))`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_round_trip_${descSnake}(self, data):`,
          `        """${propId}: round-trip — ${requirementText}"""`,
          `        # TODO: Verify round-trip: parse(serialize(x)) == x`,
          `        serialized = serialize(data)`,
          `        parsed = parse(serialized)`,
          `        assert parsed == data`,
        ].join("\n");

      case "idempotence":
        return [
          `    @given(data=st.text())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_idempotence_${descSnake}(self, data):`,
          `        """${propId}: idempotence — ${requirementText}"""`,
          `        # TODO: Verify f(f(x)) == f(x)`,
          `        once = operation(data)`,
          `        twice = operation(once)`,
          `        assert twice == once`,
        ].join("\n");

      case "state_transition":
        return [
          `    @given(event=st.text(), state=st.text())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_transition_${descSnake}(self, event, state):`,
          `        """${propId}: ${requirementText}"""`,
          `        # TODO: Verify state transition`,
          `        new_state = transition(state, event)`,
          `        assert new_state is not None`,
        ].join("\n");

      case "negative":
        return [
          `    @given(malicious_input=st.text())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_negative_${descSnake}(self, malicious_input):`,
          `        """${propId}: ${requirementText}"""`,
          `        # TODO: Verify unwanted behavior never occurs`,
          `        result = system_under_test(malicious_input)`,
          `        assert "crash" not in str(result)`,
        ].join("\n");

      case "conditional":
        return [
          `    @given(condition=st.booleans(), data=st.text())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_conditional_${descSnake}(self, condition, data):`,
          `        """${propId}: ${requirementText}"""`,
          `        assume(condition)  # Only test when condition holds`,
          `        result = system_under_test(data)`,
          `        assert result is not None`,
        ].join("\n");

      case "commutativity":
        return [
          `    @given(a=st.text(), b=st.text())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_commutativity_${descSnake}(self, a, b):`,
          `        """${propId}: commutativity — ${requirementText}"""`,
          `        # TODO: Verify f(a, b) == f(b, a)`,
          `        assert operation(a, b) == operation(b, a)`,
        ].join("\n");

      case "monotonicity":
        return [
          `    @given(x=st.integers(), y=st.integers())`,
          `    @settings(max_examples=100)`,
          `    def test_${this.snakeCase(propId)}_monotonicity_${descSnake}(self, x, y):`,
          `        """${propId}: monotonicity — ${requirementText}"""`,
          `        assume(x <= y)  # Only test ordered pairs`,
          `        assert f(x) <= f(y)`,
        ].join("\n");
    }
  }

  renderFile(properties: PbtProperty[], framework: PbtFramework, featureDir: string): string {
    const featureName =
      featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9 -]/g, "") || "Feature";
    const date = new Date().toISOString().split("T")[0];
    const body = properties.map((p) => p.test_code).join("\n\n");

    if (framework === "fast-check") {
      const header = [
        `/**`,
        ` * Auto-generated property-based tests from Specky SDD`,
        ` * Feature: ${featureName}`,
        ` * Framework: fast-check`,
        ` * Generated: ${date}`,
        ` *`,
        ` * Each property traces to an EARS requirement from SPECIFICATION.md.`,
        ` * Replace the TODO placeholders with real system calls.`,
        ` */`,
      ].join("\n");

      const imports = [
        `import { fc } from "fast-check";`,
        `import { describe, it, expect } from "vitest";`,
      ].join("\n");

      return `${header}\n\n${imports}\n\ndescribe("Property-Based Tests — ${featureName}", () => {\n${body}\n});\n`;
    }

    // hypothesis (Python)
    const header = [
      `"""`,
      `Auto-generated property-based tests from Specky SDD`,
      `Feature: ${featureName}`,
      `Framework: hypothesis`,
      `Generated: ${date}`,
      ``,
      `Each property traces to an EARS requirement from SPECIFICATION.md.`,
      `Replace the TODO placeholders with real system calls.`,
      `"""`,
    ].join("\n");

    const imports = [
      `import hypothesis`,
      `from hypothesis import given, assume, settings`,
      `from hypothesis import strategies as st`,
    ].join("\n");

    const className = featureName.replace(/[^a-zA-Z0-9]/g, "");

    return `${header}\n\n${imports}\n\n\nclass TestPropertyBased_${className}:\n    """Property-based tests generated from EARS requirements."""\n\n${body}\n`;
  }

  private snakeCase(s: string): string {
    return s
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .slice(0, 60);
  }

  private async safeRead(featureDir: string, file: string): Promise<string> {
    try {
      const parts = featureDir.split("/");
      const specDir = parts.slice(0, -1).join("/") || ".specs";
      return await this.fileManager.readSpecFile(specDir, `${parts[parts.length - 1]}/${file}`);
    } catch {
      return "";
    }
  }
}
