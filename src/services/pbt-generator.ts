/**
 * PbtGenerator — Generates property-based tests from SPECIFICATION.md.
 * Reads EARS requirements and produces framework-specific PBT files
 * for fast-check (TypeScript) or hypothesis (Python).
 */
import type { FileManager } from "./file-manager.js";
import { currentDateString } from "../utils/runtime-context.js";

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
    let currentReq: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip table rows — the acceptance-criteria summary table repeats
      // requirement text and would corrupt both tracking and extraction.
      if (line.startsWith("|")) continue;

      const reqMatch = line.match(/REQ-[A-Z]+-\d{3}/);

      if (/^(When|While|Where|If|The)\s+.+shall\s+/i.test(line)) {
        // Trace to the inline ID if present, otherwise to the requirement
        // heading ("### REQ-XXX-NNN: ...") this sentence sits under. Never
        // fabricate REQ-GEN-00N IDs — an untraceable sentence is skipped
        // rather than mislabeled.
        const reqId = reqMatch ? reqMatch[0] : currentReq;
        if (reqId) results.push({ line, reqId });
        continue;
      }

      if (reqMatch) currentReq = reqMatch[0];
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

    const increaseOccurrences = (lower.match(/\bincreas(?:e|es|ed|ing)\b/g) ?? []).length;
    const moreOccurrences = (lower.match(/\bmore\b/g) ?? []).length;
    const largerOccurrences = (lower.match(/\blarger\b/g) ?? []).length;

    // Monotonicity: proportional/scaling relationships that align with
    // the generated non-decreasing monotonicity test.
    if (
      lower.includes("monoton") ||
      lower.includes("proportional") ||
      increaseOccurrences >= 2 ||
      moreOccurrences >= 2 ||
      largerOccurrences >= 2 ||
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
    _featureDir: string,
  ): PbtProperty[] {
    const usedNames = new Set<string>();
    return requirements.map((req, i) => {
      const propId = `PROP-${String(i + 1).padStart(3, "0")}`;
      const propertyType = this.classifyPropertyType(req.line);
      const description =
        req.line.length > 100 ? req.line.slice(0, 97) + "..." : req.line;
      const testCode = this.generateTestCode(propId, description, req.line, req.reqId, propertyType, framework, usedNames);
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
    reqId: string,
    propertyType: PbtPropertyType,
    framework: PbtFramework,
    usedNames: Set<string>,
  ): string {
    const safeDesc = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    if (framework === "fast-check") {
      return this.generateFastCheckTest(propId, safeDesc, requirementText, reqId, propertyType);
    }
    return this.generateHypothesisTest(propId, description, requirementText, reqId, propertyType, usedNames);
  }

  /**
   * Pick an input arbitrary/strategy informed by the requirement text where
   * feasible; falls back to strings/text.
   */
  private inferFcArbitrary(line: string): string {
    const lower = line.toLowerCase();
    if (lower.includes("email")) return "fc.emailAddress()";
    if (/\b(count|number|amount|quantity|integer|limit|size|total|id)s?\b/.test(lower)) return "fc.integer()";
    if (/\b(date|time|timestamp)s?\b/.test(lower)) return "fc.date()";
    if (/\b(url|uri|link)s?\b/.test(lower)) return "fc.webUrl()";
    return "fc.string()";
  }

  private inferHypothesisStrategy(line: string): string {
    const lower = line.toLowerCase();
    if (lower.includes("email")) return "st.emails()";
    if (/\b(count|number|amount|quantity|integer|limit|size|total|id)s?\b/.test(lower)) return "st.integers()";
    if (/\b(date|time|timestamp)s?\b/.test(lower)) return "st.datetimes()";
    return "st.text()";
  }

  private generateFastCheckTest(
    propId: string,
    description: string,
    requirementText: string,
    reqId: string,
    propertyType: PbtPropertyType,
  ): string {
    // Every body below is a REAL runnable property against the in-file model
    // stubs defined at the top of the generated file — no undefined helpers,
    // no TODO-only bodies. The model is what the developer replaces.
    const open = (label: string) => [
      `  // Traces to: ${reqId}`,
      `  it("${propId} [${reqId}]: ${label}${description}", () => {`,
      `    // Requirement: ${requirementText}`,
      `    // Replace the in-file model with your real system call, keeping the property shape.`,
      `    fc.assert(`,
    ];
    const close = [
      `      { numRuns: 100 }`,
      `    );`,
      `  });`,
    ];

    switch (propertyType) {
      case "invariant":
        return [
          ...open(""),
          `      fc.property(${this.inferFcArbitrary(requirementText)}, fc.integer(), (input1, input2) => {`,
          `        const first = systemUnderTest(input1, input2);`,
          `        const second = systemUnderTest(input1, input2);`,
          `        expect(first).toBeDefined();`,
          `        expect(second).toEqual(first); // invariant: deterministic for identical inputs`,
          `      }),`,
          ...close,
        ].join("\n");

      case "round_trip":
        return [
          ...open("round-trip — "),
          `      fc.property(fc.jsonValue(), (value) => {`,
          `        const restored = parse(serialize(value));`,
          `        expect(restored).toEqual(value); // round-trip: parse(serialize(x)) === x`,
          `      }),`,
          ...close,
        ].join("\n");

      case "idempotence":
        return [
          ...open("idempotence — "),
          `      fc.property(fc.string(), (raw) => {`,
          `        const once = normalize(raw);`,
          `        expect(normalize(once)).toEqual(once); // idempotence: f(f(x)) === f(x)`,
          `      }),`,
          ...close,
        ].join("\n");

      case "state_transition":
        return [
          ...open("state transition — "),
          `      fc.property(fc.record({ state: fc.string(), event: fc.string() }), ({ state, event }) => {`,
          `        const next = transition(state, event);`,
          `        expect(typeof next).toBe("string"); // total: every event yields a state`,
          `        expect(transition(state, event)).toEqual(next); // deterministic transition`,
          `      }),`,
          ...close,
        ].join("\n");

      case "negative":
        return [
          ...open("negative — "),
          `      fc.property(fc.string(), (maliciousInput) => {`,
          `        expect(() => handleUntrusted(maliciousInput)).not.toThrow(); // unwanted behavior never crashes`,
          `        const result = handleUntrusted(maliciousInput);`,
          `        expect(result.ok).toBe(true);`,
          `        expect(result.error).not.toContain("crash");`,
          `      }),`,
          ...close,
        ].join("\n");

      case "conditional":
        return [
          ...open("conditional — "),
          `      fc.property(fc.boolean(), ${this.inferFcArbitrary(requirementText)}, (condition, input) => {`,
          `        fc.pre(condition); // property applies only while the condition holds`,
          `        const first = systemUnderTest(input);`,
          `        expect(first).toBeDefined();`,
          `        expect(systemUnderTest(input)).toEqual(first); // stable under the condition`,
          `      }),`,
          ...close,
        ].join("\n");

      case "commutativity":
        return [
          ...open("commutativity — "),
          `      fc.property(fc.string(), fc.string(), (a, b) => {`,
          `        expect(combine(a, b)).toEqual(combine(b, a)); // commutativity: f(a, b) === f(b, a)`,
          `      }),`,
          ...close,
        ].join("\n");

      case "monotonicity":
        return [
          ...open("monotonicity — "),
          `      fc.property(fc.integer(), fc.integer(), (x, y) => {`,
          `        fc.pre(x <= y);`,
          `        expect(scale(x)).toBeLessThanOrEqual(scale(y)); // monotone: x <= y implies f(x) <= f(y)`,
          `      }),`,
          ...close,
        ].join("\n");
    }
  }

  private generateHypothesisTest(
    propId: string,
    description: string,
    requirementText: string,
    reqId: string,
    propertyType: PbtPropertyType,
    usedNames: Set<string>,
  ): string {
    // Every body below is a REAL runnable property against the in-file model
    // stubs defined at module level in the generated file — no undefined
    // helpers, no TODO-only bodies. The model is what the developer replaces.
    const testName = (label: string) =>
      this.uniqueName(`test_${this.snakeCase(`${propId} ${reqId} ${label} ${description}`)}`, usedNames);
    const docstring = `${propId} [${reqId}]: ${requirementText.replace(/\\/g, "/").replace(/"/g, "'")}`;
    const modelNote = "        # Replace the in-file model with your real system call, keeping the property shape.";

    switch (propertyType) {
      case "invariant":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(input1=${this.inferHypothesisStrategy(requirementText)}, input2=st.integers())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("")}(self, input1, input2):`,
          `        """${docstring}"""`,
          modelNote,
          `        first = system_under_test(input1, input2)`,
          `        second = system_under_test(input1, input2)`,
          `        assert first is not None`,
          `        assert second == first  # invariant: deterministic for identical inputs`,
        ].join("\n");

      case "round_trip":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(data=st.recursive(st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False, allow_infinity=False) | st.text(), lambda children: st.lists(children) | st.dictionaries(st.text(), children), max_leaves=10))`,
          `    @settings(max_examples=100)`,
          `    def ${testName("round trip")}(self, data):`,
          `        """${docstring}"""`,
          modelNote,
          `        restored = parse(serialize(data))`,
          `        assert restored == data  # round-trip: parse(serialize(x)) == x`,
        ].join("\n");

      case "idempotence":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(raw=st.text())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("idempotence")}(self, raw):`,
          `        """${docstring}"""`,
          modelNote,
          `        once = normalize(raw)`,
          `        assert normalize(once) == once  # idempotence: f(f(x)) == f(x)`,
        ].join("\n");

      case "state_transition":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(event=st.text(), state=st.text())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("transition")}(self, event, state):`,
          `        """${docstring}"""`,
          modelNote,
          `        new_state = transition(state, event)`,
          `        assert new_state is not None  # total: every event yields a state`,
          `        assert transition(state, event) == new_state  # deterministic transition`,
        ].join("\n");

      case "negative":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(malicious_input=st.text())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("negative")}(self, malicious_input):`,
          `        """${docstring}"""`,
          modelNote,
          `        result = handle_untrusted(malicious_input)`,
          `        assert result["ok"] is True  # unwanted behavior never crashes the guard`,
          `        assert "crash" not in result["error"]`,
        ].join("\n");

      case "conditional":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(condition=st.booleans(), data=${this.inferHypothesisStrategy(requirementText)})`,
          `    @settings(max_examples=100)`,
          `    def ${testName("conditional")}(self, condition, data):`,
          `        """${docstring}"""`,
          `        assume(condition)  # property applies only while the condition holds`,
          modelNote,
          `        first = system_under_test(data)`,
          `        assert first is not None`,
          `        assert system_under_test(data) == first  # stable under the condition`,
        ].join("\n");

      case "commutativity":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(a=st.text(), b=st.text())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("commutativity")}(self, a, b):`,
          `        """${docstring}"""`,
          modelNote,
          `        assert combine(a, b) == combine(b, a)  # commutativity: f(a, b) == f(b, a)`,
        ].join("\n");

      case "monotonicity":
        return [
          `    # Traces to: ${reqId}`,
          `    @given(x=st.integers(), y=st.integers())`,
          `    @settings(max_examples=100)`,
          `    def ${testName("monotonicity")}(self, x, y):`,
          `        """${docstring}"""`,
          `        assume(x <= y)  # only ordered pairs`,
          modelNote,
          `        assert scale(x) <= scale(y)  # monotone: x <= y implies f(x) <= f(y)`,
        ].join("\n");
    }
  }

  /** Deduplicate generated method names — Python silently shadows duplicates. */
  private uniqueName(base: string, used: Set<string>): string {
    let candidate = base;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${counter}`;
      counter++;
    }
    used.add(candidate);
    return candidate;
  }

  renderFile(properties: PbtProperty[], framework: PbtFramework, featureDir: string): string {
    const featureName =
      featureDir.replace(/.*\d{3}-/, "").replace(/[^a-zA-Z0-9 -]/g, "") || "Feature";
    const date = currentDateString();
    const body = properties.map((p) => p.test_code).join("\n\n");
    const usedTypes = new Set<PbtPropertyType>(properties.map((p) => p.property_type));

    if (framework === "fast-check") {
      const header = [
        `/**`,
        ` * Auto-generated property-based tests from Specky SDD`,
        ` * Feature: ${featureName}`,
        ` * Framework: fast-check`,
        ` * Generated: ${date}`,
        ` *`,
        ` * Each property traces to an EARS requirement from SPECIFICATION.md.`,
        ` * Replace the in-file model stubs with real system calls.`,
        ` */`,
      ].join("\n");

      // fast-check ships a default export named fc — there is no `{ fc }`
      // named export, so the destructured form throws at import time.
      const imports = [
        `import fc from "fast-check";`,
        `import { describe, it, expect } from "vitest";`,
      ].join("\n");

      const models = properties.length > 0 ? `${this.fastCheckModels(usedTypes)}\n\n` : "";

      return `${header}\n\n${imports}\n\n${models}describe("Property-Based Tests — ${featureName}", () => {\n${body}\n});\n`;
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
      `Replace the in-file model stubs with real system calls.`,
      `"""`,
    ].join("\n");

    const importLines = [
      ...(usedTypes.has("round_trip") ? ["import json", ""] : []),
      `from hypothesis import assume, given, settings`,
      `from hypothesis import strategies as st`,
    ];
    const imports = importLines.join("\n");

    const models = properties.length > 0 ? `\n\n\n${this.hypothesisModels(usedTypes)}` : "";

    const className = featureName.replace(/[^a-zA-Z0-9]/g, "");

    return `${header}\n\n${imports}${models}\n\n\nclass TestPropertyBased_${className}:\n    """Property-based tests generated from EARS requirements."""\n\n${body}\n`;
  }

  /** In-file deterministic models so every generated property runs as-is. */
  private fastCheckModels(types: Set<PbtPropertyType>): string {
    const lines: string[] = [
      `// ── In-file model stubs ──────────────────────────────────────────────`,
      `// Every property below is runnable against these deterministic models.`,
      `// Replace each model with a call into your real system under test and`,
      `// keep the property shape — the model is the TODO, not the property.`,
    ];
    if (types.has("invariant") || types.has("conditional")) {
      lines.push(`const systemUnderTest = (...inputs: unknown[]): { ok: boolean; inputs: unknown[] } => ({ ok: true, inputs });`);
    }
    if (types.has("state_transition")) {
      lines.push(`const transition = (state: string, event: string): string => (event.length > 0 ? event : state);`);
    }
    if (types.has("round_trip")) {
      lines.push(
        `const serialize = (value: unknown): string => JSON.stringify(value);`,
        `const parse = (text: string): unknown => JSON.parse(text);`,
      );
    }
    if (types.has("idempotence")) {
      lines.push(`const normalize = (value: string): string => value.trim().toLowerCase();`);
    }
    if (types.has("negative")) {
      lines.push(`const handleUntrusted = (payload: string): { ok: boolean; error: string } => ({ ok: typeof payload === "string", error: "" });`);
    }
    if (types.has("commutativity")) {
      lines.push(`const combine = (a: string, b: string): string => [a, b].sort().join("|");`);
    }
    if (types.has("monotonicity")) {
      lines.push(`const scale = (x: number): number => 2 * x + 1;`);
    }
    return lines.join("\n");
  }

  /** In-file deterministic models so every generated property runs as-is. */
  private hypothesisModels(types: Set<PbtPropertyType>): string {
    const blocks: string[] = [
      [
        `# ── In-file model stubs ──────────────────────────────────────────────`,
        `# Every property below is runnable against these deterministic models.`,
        `# Replace each model with a call into your real system under test and`,
        `# keep the property shape — the model is the TODO, not the property.`,
      ].join("\n"),
    ];
    if (types.has("invariant") || types.has("conditional")) {
      blocks.push([
        `def system_under_test(*inputs):`,
        `    """Deterministic model — replace with the real system call."""`,
        `    return {"ok": True, "inputs": inputs}`,
      ].join("\n"));
    }
    if (types.has("state_transition")) {
      blocks.push([
        `def transition(state, event):`,
        `    """Pure transition model — replace with the real transition function."""`,
        `    return event if event else state`,
      ].join("\n"));
    }
    if (types.has("round_trip")) {
      blocks.push([
        `def serialize(value):`,
        `    """JSON codec model — replace with the real serializer."""`,
        `    return json.dumps(value)`,
      ].join("\n"));
      blocks.push([
        `def parse(text):`,
        `    """JSON codec model — replace with the real parser."""`,
        `    return json.loads(text)`,
      ].join("\n"));
    }
    if (types.has("idempotence")) {
      blocks.push([
        `def normalize(value):`,
        `    """Normalization model — replace with the real operation."""`,
        `    return value.strip().lower()`,
      ].join("\n"));
    }
    if (types.has("negative")) {
      blocks.push([
        `def handle_untrusted(payload):`,
        `    """Input-guard model — never raises, always returns a structured result."""`,
        `    return {"ok": isinstance(payload, str), "error": ""}`,
      ].join("\n"));
    }
    if (types.has("commutativity")) {
      blocks.push([
        `def combine(a, b):`,
        `    """Order-independent model — replace with the real operation."""`,
        `    return tuple(sorted((a, b)))`,
      ].join("\n"));
    }
    if (types.has("monotonicity")) {
      blocks.push([
        `def scale(x):`,
        `    """Monotone model — replace with the real function."""`,
        `    return 2 * x + 1`,
      ].join("\n"));
    }
    return blocks.join("\n\n\n");
  }

  private snakeCase(s: string): string {
    return s
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .slice(0, 60)
      .replace(/^_+|_+$/g, "");
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
