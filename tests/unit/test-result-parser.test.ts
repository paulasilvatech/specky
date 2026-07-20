/**
 * test-result-parser.test.ts — format auto-detection and normalization of
 * Vitest JSON, pytest JSON, flat arrays, and JUnit XML runner output.
 */
import { describe, expect, it } from "vitest";
import { TestResultParser } from "../../src/services/test-result-parser.js";

const parser = new TestResultParser();

describe("TestResultParser.parse — format detection", () => {
  it("routes input starting with '<' to the JUnit XML parser", () => {
    const results = parser.parse(`<testsuite><testcase name="t1" time="0.001"/></testsuite>`);
    expect(results).toEqual([{ test_name: "t1", passed: true, duration_ms: 1 }]);
  });

  it("returns an empty list for unparseable text", () => {
    expect(parser.parse("this is neither json nor xml")).toEqual([]);
    expect(parser.parse("")).toEqual([]);
  });

  it("returns an empty list for JSON scalars and objects without tests", () => {
    expect(parser.parse("42")).toEqual([]);
    expect(parser.parse(JSON.stringify({ foo: "bar" }))).toEqual([]);
    expect(parser.parse(JSON.stringify(null))).toEqual([]);
  });
});

describe("TestResultParser — Vitest JSON", () => {
  it("normalizes assertionResults inside testResults suites", () => {
    const raw = JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { fullName: "math > adds", status: "passed", duration: 12 },
            {
              fullName: "math > divides",
              status: "failed",
              failureMessages: ["expected 4 to be 5", "at math.test.ts:9"],
              duration: 3,
            },
          ],
        },
      ],
    });

    const results = parser.parse(raw);

    expect(results).toEqual([
      { test_name: "math > adds", passed: true, duration_ms: 12 },
      {
        test_name: "math > divides",
        passed: false,
        error: "expected 4 to be 5 at math.test.ts:9",
        duration_ms: 3,
      },
    ]);
  });

  it("accepts suites that use the tests key and skips non-object suites", () => {
    const raw = JSON.stringify({
      testResults: ["junk", { tests: [{ name: "works", status: "pass", duration: 1 }] }],
    });

    const results = parser.parse(raw);

    expect(results).toEqual([{ test_name: "works", passed: true, duration_ms: 1 }]);
  });
});

describe("TestResultParser — pytest JSON and flat arrays", () => {
  it("normalizes pytest nodeid/outcome records", () => {
    const raw = JSON.stringify({
      tests: [
        { nodeid: "tests/test_math.py::test_add", outcome: "passed", duration: 45 },
        { nodeid: "tests/test_math.py::test_div", outcome: "failed", message: "ZeroDivisionError" },
      ],
    });

    const results = parser.parse(raw);

    expect(results).toEqual([
      { test_name: "tests/test_math.py::test_add", passed: true, duration_ms: 45 },
      { test_name: "tests/test_math.py::test_div", passed: false, error: "ZeroDivisionError" },
    ]);
  });

  it("normalizes a flat array of results", () => {
    const raw = JSON.stringify([
      { name: "a", status: "PASS" },
      { name: "b", status: "skipped" },
      { name: "c", status: "failed", message: "boom" },
    ]);

    const results = parser.parse(raw);

    expect(results).toEqual([
      { test_name: "a", passed: true },
      { test_name: "b", passed: false },
      { test_name: "c", passed: false, error: "boom" },
    ]);
  });
});

describe("TestResultParser — JSON normalization details", () => {
  it("falls back to 'unknown' when no name field exists", () => {
    const results = parser.parse(JSON.stringify([{ status: "passed" }]));
    expect(results).toEqual([{ test_name: "unknown", passed: true }]);
  });

  it("omits duration_ms when duration is not a number", () => {
    const results = parser.parse(JSON.stringify([{ name: "x", status: "passed", duration: "12" }]));
    expect(results).toEqual([{ test_name: "x", passed: true }]);
  });

  it("prefers failureMessages over message and truncates to 500 characters", () => {
    const long = "x".repeat(600);
    const raw = JSON.stringify([
      { name: "t", status: "failed", failureMessages: [long], message: "short" },
    ]);

    const results = parser.parse(raw);

    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.error).toBe("x".repeat(500));
  });

  it("truncates message-based errors to 500 characters", () => {
    const raw = JSON.stringify([{ name: "t", status: "failed", message: "e".repeat(501) }]);
    const results = parser.parse(raw);
    expect(results[0]?.error).toHaveLength(500);
  });
});

describe("TestResultParser — JUnit XML", () => {
  it("parses passing, failing, and erroring testcases", () => {
    const xml = `<?xml version="1.0"?>
<testsuite name="suite" tests="3">
  <testcase name="testAdds" classname="pkg.MathTest" time="1.5"/>
  <testcase name="testDivides" classname="pkg.MathTest" time="0.012">
    <failure message="AssertionError">expected 4 but was 5</failure>
  </testcase>
  <testcase classname="pkg.OnlyClass" time="0.001">
    <error> boom </error>
  </testcase>
</testsuite>`;

    const results = parser.parse(xml);

    expect(results).toEqual([
      { test_name: "testAdds", passed: true, duration_ms: 1500 },
      {
        test_name: "testDivides",
        passed: false,
        error: "expected 4 but was 5",
        duration_ms: 12,
      },
      { test_name: "pkg.OnlyClass", passed: false, error: "boom", duration_ms: 1 },
    ]);
  });

  it("marks empty failure bodies as failed without an error message", () => {
    const results = parser.parse(
      `<testsuite><testcase name="t" time="0.002"><failure></failure></testcase></testsuite>`,
    );
    expect(results).toEqual([{ test_name: "t", passed: false, duration_ms: 2 }]);
  });

  // Characterization of current behavior (suspected bug in xmlAttr): the
  // `name="..."` attribute lookup also matches the "name" suffix of
  // "classname", so when classname is listed first its value wins.
  it("takes the classname value when classname precedes name in the attribute list", () => {
    const results = parser.parse(
      `<testsuite><testcase classname="pkg.MathTest" name="testAdds" time="0.001"/></testsuite>`,
    );
    expect(results).toEqual([{ test_name: "pkg.MathTest", passed: true, duration_ms: 1 }]);
  });

  it("prefers failure content over error content when both exist", () => {
    const results = parser.parse(
      `<testsuite><testcase name="t"><error>err</error><failure>fail</failure></testcase></testsuite>`,
    );
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.error).toBe("fail");
  });

  it("omits duration_ms when the time attribute is missing", () => {
    const results = parser.parse(`<testsuite><testcase name="t"/></testsuite>`);
    expect(results).toEqual([{ test_name: "t", passed: true }]);
  });

  it("falls back to 'unknown' when neither name nor classname exists", () => {
    const results = parser.parse(`<testsuite><testcase time="0.001"/></testsuite>`);
    expect(results).toEqual([{ test_name: "unknown", passed: true, duration_ms: 1 }]);
  });

  it("truncates long failure text to 500 characters", () => {
    const results = parser.parse(
      `<testsuite><testcase name="t"><failure>${"y".repeat(600)}</failure></testcase></testsuite>`,
    );
    expect(results[0]?.error).toHaveLength(500);
  });

  it("returns an empty list for XML without testcases", () => {
    expect(parser.parse(`<testsuite name="empty"></testsuite>`)).toEqual([]);
  });
});
