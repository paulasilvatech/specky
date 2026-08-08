import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAuditReport } from "./npm-audit-gate.mjs";

const policy = {
  1138813: {
    package: "nanoid",
    title: "nanoid: custom generators can loop indefinitely when size is zero",
    reason: "Nanoid is build-time only and no corrected 3.x release is published.",
    expiresWhen: "Nanoid 3.3.17 is published or PostCSS removes the affected line.",
  },
};

function reportWith(advisory) {
  return {
    vulnerabilities: {
      nanoid: { name: "nanoid", severity: "high", via: [advisory] },
      postcss: { name: "postcss", severity: "high", via: ["nanoid"] },
    },
  };
}

test("accepts only the exact policy advisory and transitive findings", () => {
  const result = evaluateAuditReport(
    reportWith({
      source: 1138813,
      name: "nanoid",
      title: policy["1138813"].title,
      severity: "high",
    }),
    policy,
  );
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.accepted.map(({ packageName }) => packageName),
    ["nanoid", "postcss"],
  );
});

test("fails closed for a new high advisory", () => {
  const result = evaluateAuditReport(
    reportWith({ source: 9999999, name: "nanoid", title: "New issue", severity: "high" }),
    policy,
  );
  assert.equal(result.passed, false);
  assert.deepEqual(result.blocked[0].unapprovedAdvisoryIds, ["9999999"]);
});

test("fails closed for policy metadata drift", () => {
  const result = evaluateAuditReport(
    reportWith({
      source: 1138813,
      name: "other-package",
      title: policy["1138813"].title,
      severity: "high",
    }),
    policy,
  );
  assert.equal(result.passed, false);
  assert.deepEqual(result.blocked[0].unapprovedAdvisoryIds, ["1138813"]);
});

test("fails closed when a policy entry is no longer observed", () => {
  const result = evaluateAuditReport({ vulnerabilities: {} }, policy);
  assert.equal(result.passed, false);
  assert.deepEqual(result.unusedPolicyIds, ["1138813"]);
});

test("fails closed for unresolved high findings", () => {
  const result = evaluateAuditReport(
    { vulnerabilities: { mystery: { severity: "high", via: [] } } },
    {},
  );
  assert.equal(result.passed, false);
  assert.deepEqual(result.blocked[0].unapprovedAdvisoryIds, ["unresolved:mystery"]);
});
