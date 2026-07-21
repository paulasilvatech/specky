#!/usr/bin/env node
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

function fail(message) {
  console.error(`[specky-contract-context] ${message}`);
  process.exit(2);
}

function readHookInput() {
  const fromEnvironment = process.env.SDD_HOOK_INPUT;
  if (fromEnvironment?.trim()) return fromEnvironment;
  if (process.stdin.isTTY) return "";
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseInput(raw) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function objects(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const record = value;
  return [
    record,
    record.tool_input,
    record.toolInput,
    record.arguments,
    record.input,
    record.params,
    record.params?.arguments,
    record.request?.params?.arguments,
  ].filter(
    (candidate) => typeof candidate === "object" && candidate !== null && !Array.isArray(candidate),
  );
}

function findString(input, keys) {
  for (const candidate of objects(input)) {
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function safeRelativePath(value, label) {
  if (!value || value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/.test(value)) {
    fail(`${label} must be a workspace-relative path.`);
  }
  const segments = value.split(/[\\/]/);
  if (segments.includes("..") || value.includes("\0")) fail(`${label} contains unsafe traversal.`);
  return segments.filter((segment) => segment && segment !== ".").join("/");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function fingerprintContract(contract) {
  const { fingerprint: _fingerprint, ...snapshot } = contract;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)))
    .digest("hex");
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function resolveContext() {
  const workspace = resolve(process.env.SPECKY_HOOK_WORKSPACE ?? process.cwd());
  const input = parseInput(readHookInput());
  const requestedSpecDir = process.env.SDD_SPEC_DIR ?? findString(input, ["spec_dir", "specDir"]);
  const requestedFeatureNumber =
    process.env.SDD_FEATURE_NUMBER ?? findString(input, ["feature_number", "featureNumber"]);

  if (!requestedSpecDir || !requestedFeatureNumber) {
    return { active: false, reason: "missing explicit SDD_SPEC_DIR/SDD_FEATURE_NUMBER context" };
  }
  const specDir = safeRelativePath(requestedSpecDir, "spec_dir");
  if (!/^\d{3}$/.test(requestedFeatureNumber)) fail("feature_number must be exactly three digits.");

  const specRoot = resolve(workspace, specDir);
  if (!existsSync(specRoot)) fail(`spec root does not exist: ${specDir}`);
  const matches = readdirSync(specRoot, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith(`${requestedFeatureNumber}-`),
  );
  if (matches.length !== 1) {
    fail(
      `feature ${requestedFeatureNumber} must resolve to exactly one directory in ${specDir}; found ${matches.length}.`,
    );
  }

  const featureName = matches[0].name.slice(4);
  const featureDirectory = `${specDir}/${matches[0].name}`;
  const statePath = resolve(workspace, featureDirectory, ".sdd-state.json");
  const signaturePath = `${statePath}.sig`;
  if (!existsSync(statePath) || !existsSync(signaturePath)) {
    fail(
      `feature ${requestedFeatureNumber} requires signed v5 state at ${featureDirectory}/.sdd-state.json.`,
    );
  }

  const raw = readFileSync(statePath, "utf8");
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    fail(`state is not valid JSON: ${relative(workspace, statePath)}`);
  }
  if (state.version !== "5.0.0") fail(`state version ${String(state.version)} requires migration.`);

  const key =
    process.env.SDD_STATE_KEY ??
    createHash("sha256").update(`specky-state-v1:${workspace}`).digest("hex");
  const expectedSignature = createHmac("sha256", key).update(raw).digest("hex");
  const storedSignature = readFileSync(signaturePath, "utf8").trim();
  if (!safeEqualHex(storedSignature, expectedSignature))
    fail("feature state signature verification failed.");

  if (
    state.feature?.number !== requestedFeatureNumber ||
    state.feature?.name !== featureName ||
    state.feature?.directory !== featureDirectory
  ) {
    fail(`feature state identity does not match ${featureDirectory}.`);
  }
  if (!state.contract || fingerprintContract(state.contract) !== state.contract.fingerprint) {
    fail("feature contract fingerprint verification failed.");
  }
  if (
    !Array.isArray(state.contract.phases) ||
    !state.contract.phases.includes(state.current_phase)
  ) {
    fail(`current phase ${String(state.current_phase)} is not enabled by the feature contract.`);
  }

  const capabilities = Array.isArray(state.contract.capabilities)
    ? state.contract.capabilities
    : [];
  const capabilityConfig = state.contract.capability_config ?? {};
  const configuredCapabilities = Object.keys(capabilityConfig).sort();
  const declaredCapabilities = [...new Set(capabilities)].sort();
  if (JSON.stringify(configuredCapabilities) !== JSON.stringify(declaredCapabilities)) {
    fail("capabilities and capability_config keys do not match.");
  }

  return {
    active: true,
    workspace,
    specDir,
    featureNumber: requestedFeatureNumber,
    featureName,
    featureDirectory,
    statePath: relative(workspace, statePath).split(sep).join("/"),
    phase: state.current_phase,
    contract: state.contract,
    gateDecision: state.gate_decision?.decision ?? "",
  };
}

function printShell(context) {
  const contract = context.contract ?? {};
  const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
  const release = contract.capability_config?.release;
  const tdd = contract.capability_config?.tdd;
  const compliance = contract.capability_config?.compliance;
  const development = contract.capability_config?.["dev-environment"];
  const iac = contract.capability_config?.iac;
  const values = {
    SPECKY_CONTEXT_ACTIVE: context.active ? "1" : "0",
    SPECKY_CONTEXT_REASON: context.reason ?? "",
    SPECKY_SPEC_DIR: context.specDir ?? "",
    SPECKY_FEATURE_NUMBER: context.featureNumber ?? "",
    SPECKY_FEATURE_NAME: context.featureName ?? "",
    SPECKY_FEATURE_DIR: context.featureDirectory ?? "",
    SPECKY_STATE_FILE: context.statePath ?? "",
    SPECKY_PHASE: context.phase ?? "",
    SPECKY_CONTRACT_ID: contract.id ?? "",
    SPECKY_CONTRACT_FINGERPRINT: contract.fingerprint ?? "",
    SPECKY_LIFECYCLE: contract.lifecycle ?? "",
    SPECKY_WORKLOAD: contract.workload ?? "",
    SPECKY_EXECUTION_MODE: contract.execution_mode ?? "",
    SPECKY_CAPABILITIES: capabilities.join(","),
    SPECKY_GATE_DECISION: context.gateDecision ?? "",
    SPECKY_RELEASE_ENABLED: release ? "1" : "0",
    SPECKY_BRANCH_PREFIX: release?.branch_prefix ?? "",
    SPECKY_BASE_BRANCH: release?.base_branch ?? "",
    SPECKY_CHECKPOINTS_REQUIRED: release?.checkpoints ? "1" : "0",
    SPECKY_TDD_ENABLED: tdd ? "1" : "0",
    SPECKY_TDD_THRESHOLD: tdd ? String(tdd.coverage_threshold) : "",
    SPECKY_COMPLIANCE_ENABLED: compliance ? "1" : "0",
    SPECKY_COMPLIANCE_FRAMEWORKS: compliance?.frameworks?.join(",") ?? "",
    SPECKY_DEV_ENV_ENABLED: development ? "1" : "0",
    SPECKY_DEV_LANGUAGE: development?.language ?? "",
    SPECKY_IAC_ENABLED: iac ? "1" : "0",
    SPECKY_IAC_PROVIDER: iac?.provider ?? "",
    SPECKY_IAC_CLOUD: iac?.cloud ?? "",
  };
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${shellQuote(value)}`);
}

const command = process.argv[2] ?? "shell";
const context = resolveContext();
if (command === "json") {
  console.log(JSON.stringify(context));
} else if (command === "shell") {
  printShell(context);
} else {
  fail(`unknown command ${command}`);
}
