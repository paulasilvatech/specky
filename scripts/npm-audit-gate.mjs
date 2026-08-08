#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function collectAdvisories(packageName, vulnerabilities, visited = new Set()) {
  if (visited.has(packageName)) return { advisories: new Map(), unresolved: [] };
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return { advisories: new Map(), unresolved: [packageName] };

  const nextVisited = new Set(visited).add(packageName);
  const advisories = new Map();
  const unresolved = [];
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === "string") {
      const nested = collectAdvisories(cause, vulnerabilities, nextVisited);
      for (const [id, advisory] of nested.advisories) advisories.set(id, advisory);
      unresolved.push(...nested.unresolved);
      continue;
    }
    if (cause?.source != null) {
      advisories.set(String(cause.source), {
        id: String(cause.source),
        packageName: String(cause.name ?? packageName),
        title: String(cause.title ?? ""),
      });
      continue;
    }
    unresolved.push(packageName);
  }
  return { advisories, unresolved };
}

function policyMatches(advisory, policyEntry) {
  return (
    policyEntry &&
    policyEntry.package === advisory.packageName &&
    policyEntry.title === advisory.title &&
    typeof policyEntry.reason === "string" &&
    policyEntry.reason.length > 0 &&
    typeof policyEntry.expiresWhen === "string" &&
    policyEntry.expiresWhen.length > 0
  );
}

export function evaluateAuditReport(report, policy, threshold = "high") {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const thresholdRank = SEVERITY_RANK[threshold];
  if (thresholdRank == null) throw new Error(`Unsupported audit threshold: ${threshold}`);

  const accepted = [];
  const blocked = [];
  const observedAdvisoryIds = new Set();
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    if ((SEVERITY_RANK[vulnerability.severity] ?? -1) < thresholdRank) continue;
    const { advisories, unresolved } = collectAdvisories(packageName, vulnerabilities);
    for (const advisoryId of advisories.keys()) observedAdvisoryIds.add(advisoryId);
    const unapprovedAdvisoryIds = [...advisories.values()]
      .filter((advisory) => !policyMatches(advisory, policy[advisory.id]))
      .map(({ id }) => id);
    if (advisories.size === 0) unapprovedAdvisoryIds.push(`unresolved:${packageName}`);
    unapprovedAdvisoryIds.push(...unresolved.map((name) => `unresolved:${name}`));
    const finding = {
      packageName,
      severity: vulnerability.severity,
      advisoryIds: [...advisories.keys()].sort((left, right) => left.localeCompare(right)),
      unapprovedAdvisoryIds: [...new Set(unapprovedAdvisoryIds)].sort((left, right) =>
        left.localeCompare(right),
      ),
    };
    if (finding.unapprovedAdvisoryIds.length > 0) blocked.push(finding);
    else accepted.push(finding);
  }

  const unusedPolicyIds = Object.keys(policy)
    .filter((advisoryId) => !observedAdvisoryIds.has(advisoryId))
    .sort((left, right) => left.localeCompare(right));
  return {
    passed: blocked.length === 0 && unusedPolicyIds.length === 0,
    accepted,
    blocked,
    unusedPolicyIds,
  };
}

function parseArguments(args) {
  const options = { threshold: "high", policyPath: null };
  for (const argument of args) {
    if (argument.startsWith("--audit-level=")) {
      options.threshold = argument.slice("--audit-level=".length);
    } else if (argument.startsWith("--policy=")) {
      options.policyPath = argument.slice("--policy=".length);
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  if (!options.policyPath) throw new Error("--policy=<path> is required");
  return options;
}

function parseAuditJson(output) {
  const jsonStart = output.indexOf("{");
  if (jsonStart < 0) throw new Error("npm audit returned no JSON payload");
  return JSON.parse(output.slice(jsonStart));
}

function run() {
  const options = parseArguments(process.argv.slice(2));
  const policy = JSON.parse(fs.readFileSync(path.resolve(options.policyPath), "utf8"));
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const audit = spawnSync(command, ["audit", "--json", `--audit-level=${options.threshold}`], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (audit.error) throw audit.error;

  const result = evaluateAuditReport(parseAuditJson(audit.stdout), policy, options.threshold);
  for (const finding of result.accepted) {
    console.log(`ACCEPTED ${finding.packageName}: ${finding.advisoryIds.join(", ")}`);
  }
  for (const finding of result.blocked) {
    console.error(`BLOCKED ${finding.packageName}: ${finding.unapprovedAdvisoryIds.join(", ")}`);
  }
  for (const advisoryId of result.unusedPolicyIds) {
    console.error(`BLOCKED unused policy entry: ${advisoryId}`);
  }
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(`BLOCKED audit gate error: ${error.message}`);
    process.exitCode = 1;
  }
}
