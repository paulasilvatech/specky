/**
 * slug.test.ts — canonical slugification for feature directory names.
 */
import { describe, expect, it } from "vitest";
import { featureDirName, slugify } from "../../src/utils/slug.js";

describe("slugify", () => {
  it("converts a simple name to kebab-case", () => {
    expect(slugify("User Authentication")).toBe("user-authentication");
  });

  it("handles multiple spaces and special characters", () => {
    expect(slugify("  My   Feature!  ")).toBe("my-feature");
    expect(slugify("API + OAuth2")).toBe("api-oauth2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("--already--slug--")).toBe("already-slug");
  });

  it("returns 'feature' for empty or all-invalid input", () => {
    expect(slugify("")).toBe("feature");
    expect(slugify("!!!")).toBe("feature");
  });

  it("handles unicode and numbers", () => {
    expect(slugify("Feature 123")).toBe("feature-123");
  });
});

describe("featureDirName", () => {
  it("builds the canonical NNN-slug directory name", () => {
    expect(featureDirName("001", "User Auth")).toBe("001-user-auth");
    expect(featureDirName("042", "Todo API")).toBe("042-todo-api");
  });
});
