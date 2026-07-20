/**
 * update-check.ts — once-daily npm registry update check (Layer 2 of update
 * awareness; Layer 1 is the zero-network install.json version-drift advisory
 * printed by doctor/status and the MCP server).
 *
 * Design constraints (see README "Staying up to date"):
 *   - CLI only — NEVER invoked by `specky serve` / the MCP server.
 *   - Fail-silent — every error (offline, timeout, bad JSON, unwritable cache)
 *     returns null. An update check must never break or delay a command.
 *   - Opt-out: SPECKY_NO_UPDATE_CHECK=1, CI=true, or `update_check: false`
 *     in .specky/config.yml (the config gate lives in the CLI dispatcher).
 *   - At most one network request per 24h, cached in ~/.specky/update-check.json.
 *   - The request is a single GET to registry.npmjs.org — no telemetry.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { dirname, join } from "node:path";
import { VERSION } from "../../constants.js";

/** Registry endpoint for the published package's `latest` dist-tag. */
const REGISTRY_LATEST_URL = "https://registry.npmjs.org/specky-sdd/latest";

/** Re-check at most once per 24 hours. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Abort the registry request after ~2s — never make a CLI command feel slow. */
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Minimal structural fetch type — the global `fetch` satisfies it, and tests
 * can inject a plain async function without building real Response objects.
 */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Everything impure is injectable so tests never touch network or $HOME. */
export interface UpdateCheckOptions {
  fetchImpl?: FetchLike;
  homedir?: () => string;
  now?: () => number;
  currentVersion?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

interface UpdateCache {
  checked_at: number;
  latest: string;
}

interface ParsedVersion {
  core: number[];
  prerelease: string[];
}

function parseVersion(version: string): ParsedVersion {
  // Tolerate leading "v" and strip build metadata ("+sha") — compare loosely,
  // never throw on malformed input.
  const clean = version.trim().replace(/^v/i, "").split("+")[0] ?? "";
  const dash = clean.indexOf("-");
  const coreStr = dash >= 0 ? clean.slice(0, dash) : clean;
  const preStr = dash >= 0 ? clean.slice(dash + 1) : "";
  const core = coreStr.split(".").map((seg) => {
    const n = Number.parseInt(seg, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return { core, prerelease: preStr ? preStr.split(".") : [] };
}

function comparePrereleaseIds(a: string, b: string): -1 | 0 | 1 {
  const numA = /^\d+$/.test(a) ? Number.parseInt(a, 10) : null;
  const numB = /^\d+$/.test(b) ? Number.parseInt(b, 10) : null;
  if (numA !== null && numB !== null) {
    return numA === numB ? 0 : numA < numB ? -1 : 1;
  }
  // Numeric identifiers sort below alphanumeric ones (semver §11).
  if (numA !== null) return -1;
  if (numB !== null) return 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Compare two version strings numerically segment-by-segment.
 * Returns -1 when a < b, 0 when equal, 1 when a > b.
 *
 * Semver-ish, defensive: numeric core segments (missing = 0, non-numeric = 0),
 * a prerelease sorts LOWER than its release ("3.7.0-beta.1" < "3.7.0"), and
 * garbage input never throws.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  const coreLen = Math.max(va.core.length, vb.core.length);
  for (let i = 0; i < coreLen; i++) {
    const x = va.core[i] ?? 0;
    const y = vb.core[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }

  // Equal cores: no-prerelease > prerelease.
  if (va.prerelease.length === 0 && vb.prerelease.length === 0) return 0;
  if (va.prerelease.length === 0) return 1;
  if (vb.prerelease.length === 0) return -1;

  const preLen = Math.max(va.prerelease.length, vb.prerelease.length);
  for (let i = 0; i < preLen; i++) {
    const x = va.prerelease[i];
    const y = vb.prerelease[i];
    if (x === undefined) return -1; // shorter prerelease list is lower
    if (y === undefined) return 1;
    const cmp = comparePrereleaseIds(x, y);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function readCachedLatest(cachePath: string, now: number): string | null {
  try {
    const cache = JSON.parse(readFileSync(cachePath, "utf8")) as Partial<UpdateCache>;
    if (typeof cache.checked_at !== "number" || typeof cache.latest !== "string") return null;
    if (now - cache.checked_at >= CACHE_TTL_MS) return null;
    return cache.latest;
  } catch {
    return null; // absent or corrupt cache = cache miss
  }
}

function writeCacheBestEffort(cachePath: string, cache: UpdateCache): void {
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
  } catch {
    // Unwritable cache is fine — we just re-check next time.
  }
}

async function fetchLatestVersion(fetchImpl: FetchLike, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(REGISTRY_LATEST_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body === "object" &&
      body !== null &&
      typeof body.version === "string" &&
      body.version.length > 0
      ? body.version
      : null;
  } catch {
    return null; // offline, DNS failure, timeout abort, bad JSON — all silent
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return the newer published version string when the npm `latest` for
 * specky-sdd is greater than the running VERSION, else null.
 * Never throws, never prints — callers decide whether/where to render.
 */
export async function checkForUpdate(opts: UpdateCheckOptions = {}): Promise<string | null> {
  try {
    const env = opts.env ?? process.env;
    const isSet = (v: string | undefined): boolean => v === "1" || v === "true";
    // Never nag CI, and honor the explicit opt-out — both skip the network entirely.
    if (isSet(env["SPECKY_NO_UPDATE_CHECK"]) || isSet(env["CI"])) return null;

    const fetchImpl: FetchLike = opts.fetchImpl ?? fetch;
    const home = (opts.homedir ?? osHomedir)();
    const now = (opts.now ?? Date.now)();
    const currentVersion = opts.currentVersion ?? VERSION;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const cachePath = join(home, ".specky", "update-check.json");
    let latest = readCachedLatest(cachePath, now);
    if (latest === null) {
      latest = await fetchLatestVersion(fetchImpl, timeoutMs);
      if (latest === null) return null;
      writeCacheBestEffort(cachePath, { checked_at: now, latest });
    }

    return compareSemver(latest, currentVersion) > 0 ? latest : null;
  } catch {
    return null; // an update check must never surface an error
  }
}
