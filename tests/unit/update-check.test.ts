/**
 * update-check.test.ts — the once-daily update check is correct AND harmless:
 *   - compareSemver orders numeric segments, prereleases below releases
 *   - checkForUpdate reports only strictly-newer versions
 *   - the 24h cache prevents repeat network hits; an expired cache refetches
 *   - opt-outs (SPECKY_NO_UPDATE_CHECK=1, CI=true) skip the network entirely
 *   - every failure mode (offline, timeout, bad JSON, unwritable cache)
 *     degrades silently — no throw, no crash
 * All dependencies are injected — these tests never touch the real network
 * or the real $HOME.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkForUpdate,
  compareSemver,
  type FetchLike,
  type UpdateCheckOptions,
} from "../../src/cli/lib/update-check.js";

describe("compareSemver", () => {
  const matrix: Array<[string, string, -1 | 0 | 1]> = [
    // equality
    ["3.6.0", "3.6.0", 0],
    ["v3.6.0", "3.6.0", 0],
    ["3.6.0+build.5", "3.6.0", 0],
    // simple ordering
    ["3.6.0", "3.7.0", -1],
    ["3.7.0", "3.6.0", 1],
    ["3.6.0", "3.6.1", -1],
    ["3.9.9", "4.0.0", -1],
    // numeric, not lexicographic
    ["3.10.0", "3.9.0", 1],
    ["0.2.0", "0.10.0", -1],
    // longer / shorter segment lists (missing = 0)
    ["3.6", "3.6.0", 0],
    ["3.6.0.1", "3.6.0", 1],
    ["3.6.0", "3.6.0.1", -1],
    // prerelease is LOWER than its release
    ["3.7.0-beta.1", "3.7.0", -1],
    ["3.7.0", "3.7.0-beta.1", 1],
    // prerelease ordering
    ["3.7.0-alpha", "3.7.0-beta", -1],
    ["3.7.0-beta.1", "3.7.0-beta.2", -1],
    ["3.7.0-beta", "3.7.0-beta.1", -1], // shorter prerelease list is lower
    ["3.7.0-1", "3.7.0-alpha", -1], // numeric ids sort below alphanumeric
    ["3.7.0-beta.2", "3.7.0-beta.2", 0],
    // defensive: non-numeric core segments are treated as 0, never throw
    ["3.x.0", "3.0.0", 0],
    ["garbage", "0.0.0", 0],
    ["garbage", "0.0.1", -1],
  ];

  it.each(matrix)("compareSemver(%s, %s) === %i", (a, b, expected) => {
    expect(compareSemver(a, b)).toBe(expected);
  });

  it("is antisymmetric across the matrix", () => {
    for (const [a, b, expected] of matrix) {
      // `|| 0` normalizes -0 to 0 (toBe uses Object.is, which separates them)
      expect(compareSemver(b, a)).toBe((-expected || 0) as -1 | 0 | 1);
    }
  });
});

describe("checkForUpdate", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "specky-update-check-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  /** Counting fake registry fetch. */
  function makeFetch(version: string, calls: { count: number }): FetchLike {
    return async () => {
      calls.count++;
      return { ok: true, json: async () => ({ version }) };
    };
  }

  /** Baseline options: isolated home, pinned clock, empty env (no ambient CI=true). */
  function baseOpts(overrides: Partial<UpdateCheckOptions> = {}): UpdateCheckOptions {
    return {
      homedir: () => home,
      now: () => 1_000_000_000_000,
      currentVersion: "3.6.0",
      env: {},
      ...overrides,
    };
  }

  const cachePath = (): string => join(home, ".specky", "update-check.json");

  it("returns the newer version and writes the cache file", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.7.0", calls) }));
    expect(result).toBe("3.7.0");
    expect(calls.count).toBe(1);

    const cache = JSON.parse(readFileSync(cachePath(), "utf8")) as {
      checked_at: number;
      latest: string;
    };
    expect(cache.latest).toBe("3.7.0");
    expect(cache.checked_at).toBe(1_000_000_000_000);
  });

  it("returns null when latest equals the current version", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.6.0", calls) }));
    expect(result).toBeNull();
    expect(calls.count).toBe(1);
  });

  it("returns null when latest is older than the current version", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.5.9", calls) }));
    expect(result).toBeNull();
  });

  it("returns null when latest is a prerelease of the current version", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.6.0-rc.1", calls) }));
    expect(result).toBeNull();
  });

  it("honors the 24h cache — a second call within the TTL does not fetch", async () => {
    const calls = { count: 0 };
    const fetchImpl = makeFetch("3.7.0", calls);
    const t0 = 1_000_000_000_000;

    await checkForUpdate(baseOpts({ fetchImpl, now: () => t0 }));
    expect(calls.count).toBe(1);

    // 23 hours later: cache hit, still reports the update, no new fetch.
    const again = await checkForUpdate(
      baseOpts({ fetchImpl, now: () => t0 + 23 * 60 * 60 * 1000 }),
    );
    expect(again).toBe("3.7.0");
    expect(calls.count).toBe(1);
  });

  it("refetches once the cache is older than 24h", async () => {
    const calls = { count: 0 };
    const fetchImpl = makeFetch("3.7.0", calls);
    const t0 = 1_000_000_000_000;

    await checkForUpdate(baseOpts({ fetchImpl, now: () => t0 }));
    expect(calls.count).toBe(1);

    const later = await checkForUpdate(
      baseOpts({ fetchImpl, now: () => t0 + 25 * 60 * 60 * 1000 }),
    );
    expect(later).toBe("3.7.0");
    expect(calls.count).toBe(2);
  });

  it("treats a corrupt cache file as a miss and refetches", async () => {
    const calls = { count: 0 };
    mkdirSync(join(home, ".specky"), { recursive: true });
    writeFileSync(cachePath(), "not json{", "utf8");

    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.7.0", calls) }));
    expect(result).toBe("3.7.0");
    expect(calls.count).toBe(1);
  });

  it("SPECKY_NO_UPDATE_CHECK=1 skips the network entirely", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(
      baseOpts({
        fetchImpl: makeFetch("9.9.9", calls),
        env: { SPECKY_NO_UPDATE_CHECK: "1" },
      }),
    );
    expect(result).toBeNull();
    expect(calls.count).toBe(0);
  });

  it("CI=true skips the network entirely — never nag CI", async () => {
    const calls = { count: 0 };
    const result = await checkForUpdate(
      baseOpts({ fetchImpl: makeFetch("9.9.9", calls), env: { CI: "true" } }),
    );
    expect(result).toBeNull();
    expect(calls.count).toBe(0);
  });

  it("returns null silently when the fetch rejects (offline)", async () => {
    const failingFetch: FetchLike = async () => {
      throw new Error("ENOTFOUND registry.npmjs.org");
    };
    await expect(checkForUpdate(baseOpts({ fetchImpl: failingFetch }))).resolves.toBeNull();
  });

  it("returns null when the request times out (abort signal fires)", async () => {
    const hangingFetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    await expect(
      checkForUpdate(baseOpts({ fetchImpl: hangingFetch, timeoutMs: 20 })),
    ).resolves.toBeNull();
  });

  it("returns null on a non-OK registry response", async () => {
    const notFoundFetch: FetchLike = async () => ({
      ok: false,
      json: async () => ({}),
    });
    await expect(checkForUpdate(baseOpts({ fetchImpl: notFoundFetch }))).resolves.toBeNull();
  });

  it("returns null on bad JSON / missing version field", async () => {
    const badJsonFetch: FetchLike = async () => ({
      ok: true,
      json: async () => {
        throw new Error("unexpected token");
      },
    });
    await expect(checkForUpdate(baseOpts({ fetchImpl: badJsonFetch }))).resolves.toBeNull();

    const noVersionFetch: FetchLike = async () => ({ ok: true, json: async () => ({}) });
    await expect(checkForUpdate(baseOpts({ fetchImpl: noVersionFetch }))).resolves.toBeNull();
  });

  it("still returns the result when the cache dir is unwritable", async () => {
    // A FILE named .specky makes mkdir/write of the cache path fail on every
    // platform (works even when tests run as root, unlike chmod tricks).
    writeFileSync(join(home, ".specky"), "i am a file, not a directory", "utf8");

    const calls = { count: 0 };
    const result = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.7.0", calls) }));
    expect(result).toBe("3.7.0");
    expect(calls.count).toBe(1);

    // And the next call refetches (cache never landed) — still no crash.
    const again = await checkForUpdate(baseOpts({ fetchImpl: makeFetch("3.7.0", calls) }));
    expect(again).toBe("3.7.0");
    expect(calls.count).toBe(2);
  });
});
