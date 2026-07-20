/**
 * Single source for placeholder/trivial-test detection patterns.
 * Used by use-case contract validation, test generation, and PBT generation
 * to reject stub bodies that would fake traceability.
 */

/** Trivial unit-test bodies: TODO markers, `expect(true)`, tautological asserts. */
export const TRIVIAL_TEST_BODY_PATTERN =
  /(?:\/\/|#|\/\*|\[)\s*TODO\b|expect\(true\)|assert\s+True|assertTrue\(true\)|Assert\.True\(true\)|toBeTruthy\(\)/i;

/** Trivial property-test bodies: TODO markers, `return true`, `assert True`. */
export const TRIVIAL_PROPERTY_BODY_PATTERN =
  /(?:\/\/|#|\/\*|\[)\s*TODO\b|return\s+true\b|assert\s+True\b/i;
