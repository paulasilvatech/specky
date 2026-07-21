/**
 * TestResultParser — Parses test runner output into a normalized TestResult[].
 * Supports: Vitest JSON, pytest JSON, JUnit XML.
 */

export interface TestResult {
  test_name: string;
  passed: boolean;
  error?: string;
  duration_ms?: number;
}

export class TestResultParser {
  /**
   * Auto-detect format and parse.
   */
  parse(raw: string): TestResult[] {
    const trimmed = raw.trim();
    if (trimmed.startsWith("<")) return this.parseJUnit(trimmed);
    try {
      const json = JSON.parse(trimmed) as unknown;
      return this.parseJson(json);
    } catch {
      return [];
    }
  }

  /** Vitest JSON: { testResults: [{ name, status, message? }] } or flat array */
  private parseJson(json: unknown): TestResult[] {
    if (!json || typeof json !== "object") return [];

    // Vitest format: { testResults: [...] }
    if ("testResults" in json && Array.isArray((json as Record<string, unknown>)["testResults"])) {
      return ((json as Record<string, unknown>)["testResults"] as unknown[]).flatMap((suite) => {
        if (!suite || typeof suite !== "object") return [];
        const s = suite as Record<string, unknown>;
        const tests = (s["assertionResults"] as unknown[]) ?? (s["tests"] as unknown[]) ?? [];
        return tests.map((t) => this.normalizeJsonTest(t as Record<string, unknown>));
      });
    }

    // pytest JSON: { tests: [...] }
    if ("tests" in json && Array.isArray((json as Record<string, unknown>)["tests"])) {
      return ((json as Record<string, unknown>)["tests"] as unknown[]).map((t) =>
        this.normalizeJsonTest(t as Record<string, unknown>),
      );
    }

    // Flat array
    if (Array.isArray(json)) {
      return (json as unknown[]).map((t) => this.normalizeJsonTest(t as Record<string, unknown>));
    }

    return [];
  }

  private normalizeJsonTest(t: Record<string, unknown>): TestResult {
    const name = String(t["name"] ?? t["nodeid"] ?? t["fullName"] ?? "unknown");
    const statusStr = String(t["status"] ?? t["outcome"] ?? "").toLowerCase();
    const passed = statusStr === "passed" || statusStr === "pass";
    const failureMessages = t["failureMessages"] as string[] | undefined;
    const error = failureMessages
      ? failureMessages.join(" ").slice(0, 500)
      : t["message"]
        ? String(t["message"]).slice(0, 500)
        : undefined;
    const duration_ms = typeof t["duration"] === "number" ? (t["duration"] as number) : undefined;
    return {
      test_name: name,
      passed,
      ...(error ? { error } : {}),
      ...(duration_ms !== undefined ? { duration_ms } : {}),
    };
  }

  /** JUnit XML: <testcase name="..." time="..."><failure>...</failure></testcase> */
  private parseJUnit(xml: string): TestResult[] {
    const results: TestResult[] = [];
    // Self-closing alternative must come first to avoid greedy [^>]* consuming the trailing slash
    const testcaseRegex = /<testcase\s([^>]*)\/>|<testcase\s([^>]*)(?<!\/)>([\s\S]*?)<\/testcase>/g;
    for (const m of xml.matchAll(testcaseRegex)) {
      const attrs = m[1] ?? m[2] ?? ""; // m[1]: self-closing attrs; m[2]: open-tag attrs
      const inner = m[3] ?? ""; // m[3]: content between open and close tags
      const name = this.xmlAttr(attrs, "name") ?? this.xmlAttr(attrs, "classname") ?? "unknown";
      const timeStr = this.xmlAttr(attrs, "time");
      const duration_ms = timeStr ? Math.round(parseFloat(timeStr) * 1000) : undefined;
      const failureMatch = inner.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
      const errorMatch = inner.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      const errorText =
        (failureMatch?.[1] ?? errorMatch?.[1] ?? "").slice(0, 500).trim() || undefined;
      results.push({
        test_name: name,
        passed: !failureMatch && !errorMatch,
        ...(errorText ? { error: errorText } : {}),
        ...(duration_ms !== undefined ? { duration_ms } : {}),
      });
    }
    return results;
  }

  private xmlAttr(attrs: string, key: string): string | undefined {
    const m = attrs.match(new RegExp(`${key}="([^"]*)"`, "i"));
    return m?.[1];
  }
}
