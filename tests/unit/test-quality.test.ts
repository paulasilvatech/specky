/**
 * test-quality.test.ts — trivial/stub test body detection patterns.
 */
import { describe, expect, it } from "vitest";
import {
  TRIVIAL_PROPERTY_BODY_PATTERN,
  TRIVIAL_TEST_BODY_PATTERN,
} from "../../src/utils/test-quality.js";

describe("TRIVIAL_TEST_BODY_PATTERN", () => {
  it("matches TODO markers in common comment styles", () => {
    expect(TRIVIAL_TEST_BODY_PATTERN.test("// TODO implement")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("# TODO implement")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("/* TODO */")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("[ TODO ]")).toBe(true);
  });

  it("matches tautological expectations", () => {
    expect(TRIVIAL_TEST_BODY_PATTERN.test("expect(true)")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("assert True")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("assertTrue(true)")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("Assert.True(true)")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("toBeTruthy()")).toBe(true);
  });

  it("does not match meaningful assertions", () => {
    expect(TRIVIAL_TEST_BODY_PATTERN.test("expect(result).toBe(42)")).toBe(false);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("assertEqual(a, b)")).toBe(false);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("toBe(false)")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(TRIVIAL_TEST_BODY_PATTERN.test("// todo implement")).toBe(true);
    expect(TRIVIAL_TEST_BODY_PATTERN.test("EXPECT(TRUE)")).toBe(true);
  });
});

describe("TRIVIAL_PROPERTY_BODY_PATTERN", () => {
  it("matches TODO markers in common comment styles", () => {
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("// TODO implement")).toBe(true);
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("# TODO implement")).toBe(true);
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("/* TODO */")).toBe(true);
  });

  it("matches vacuous property bodies", () => {
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("return true")).toBe(true);
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("assert True")).toBe(true);
  });

  it("does not match meaningful property bodies", () => {
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("return a === b")).toBe(false);
    expect(TRIVIAL_PROPERTY_BODY_PATTERN.test("return fc.pre(a > 0)")).toBe(false);
  });
});
