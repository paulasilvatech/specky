import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import {
  errorResult,
  formatError,
  jsonResult,
  textResult,
  truncate,
} from "../../src/tools/tool-result.js";

describe("truncate", () => {
  it("returns text at or under the character limit unchanged", () => {
    const short = "short payload";
    expect(truncate(short)).toBe(short);

    const atLimit = "x".repeat(CHARACTER_LIMIT);
    expect(truncate(atLimit)).toBe(atLimit);
    expect(truncate(atLimit)).toHaveLength(CHARACTER_LIMIT);
  });

  it("truncates over-limit text and appends the marker", () => {
    const overLimit = "y".repeat(CHARACTER_LIMIT + 500);
    const result = truncate(overLimit);
    expect(result.startsWith("y".repeat(CHARACTER_LIMIT))).toBe(true);
    expect(result).toContain("[TRUNCATED] Response exceeded 25,000 characters.");
    expect(result).toContain("sdd_get_status");
    expect(result.length).toBeGreaterThan(CHARACTER_LIMIT);
    // The kept body is exactly CHARACTER_LIMIT characters of the original.
    expect(result.slice(0, CHARACTER_LIMIT)).toBe("y".repeat(CHARACTER_LIMIT));
  });
});

describe("formatError", () => {
  it("formats an Error with the tool name prefix", () => {
    expect(formatError("sdd_get_status", new Error("state missing"))).toBe(
      "[sdd_get_status] Error: state missing",
    );
  });

  it("formats non-Error thrown values via String()", () => {
    expect(formatError("sdd_amend", "plain string failure")).toBe(
      "[sdd_amend] Error: plain string failure",
    );
    expect(formatError("sdd_amend", 42)).toBe("[sdd_amend] Error: 42");
  });
});

describe("textResult", () => {
  it("wraps raw text in a single text content envelope", () => {
    const result = textResult("hello");
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
    expect(result.isError).toBeUndefined();
  });

  it("applies truncation to over-limit text", () => {
    const result = textResult("z".repeat(CHARACTER_LIMIT + 10));
    expect(result.content[0].text).toContain("[TRUNCATED]");
  });
});

describe("jsonResult", () => {
  it("serializes payloads as pretty-printed JSON inside the envelope", () => {
    const result = jsonResult({ status: "ok", count: 2 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(JSON.stringify({ status: "ok", count: 2 }, null, 2));
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "ok", count: 2 });
  });
});

describe("errorResult", () => {
  it("builds an isError result with the formatted message", () => {
    const result = errorResult("sdd_create_pr", new Error("gate blocked"));
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "[sdd_create_pr] Error: gate blocked" }]);
  });

  it("handles non-Error thrown values", () => {
    const result = errorResult("sdd_generate_iac", { odd: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("[sdd_generate_iac] Error: [object Object]");
  });
});
