import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RateLimiter } from "../../src/services/rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the burst limit immediately", () => {
    const limiter = new RateLimiter(60, 5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.checkRateLimit("client1").allowed).toBe(true);
    }
  });

  it("denies the request after burst is exhausted", () => {
    const limiter = new RateLimiter(60, 3);
    limiter.checkRateLimit("client1");
    limiter.checkRateLimit("client1");
    limiter.checkRateLimit("client1");
    const result = limiter.checkRateLimit("client1");
    expect(result.allowed).toBe(false);
  });

  it("provides retry_after_ms when denying a request", () => {
    const limiter = new RateLimiter(60, 1);
    limiter.checkRateLimit("client1"); // exhaust burst
    const result = limiter.checkRateLimit("client1");
    expect(result.allowed).toBe(false);
    expect(result.retry_after_ms).toBeGreaterThan(0);
  });

  it("refills tokens after the refill interval elapses", () => {
    const limiter = new RateLimiter(60, 1);
    limiter.checkRateLimit("client1"); // exhaust
    expect(limiter.checkRateLimit("client1").allowed).toBe(false);

    // Advance time by 1 second (1 token refills at 60 rpm = 1/sec)
    vi.advanceTimersByTime(1000);
    expect(limiter.checkRateLimit("client1").allowed).toBe(true);
  });

  it("tracks different clients independently", () => {
    const limiter = new RateLimiter(60, 1);
    limiter.checkRateLimit("clientA"); // exhaust clientA
    // clientB should still have its full burst
    expect(limiter.checkRateLimit("clientB").allowed).toBe(true);
  });

  it("does not exceed burst on refill", () => {
    const limiter = new RateLimiter(60, 3);
    // Advance far into the future — should still cap at burst
    vi.advanceTimersByTime(60_000);
    limiter.checkRateLimit("client1");
    limiter.checkRateLimit("client1");
    limiter.checkRateLimit("client1");
    const result = limiter.checkRateLimit("client1");
    expect(result.allowed).toBe(false);
  });

  it("resetLimits clears all buckets", () => {
    const limiter = new RateLimiter(60, 1);
    limiter.checkRateLimit("client1"); // exhaust
    limiter.resetLimits();
    // After reset, client1 gets a fresh bucket with full burst
    expect(limiter.checkRateLimit("client1").allowed).toBe(true);
  });

  it("activeClients returns the number of tracked clients", () => {
    const limiter = new RateLimiter(60, 5);
    expect(limiter.activeClients).toBe(0);
    limiter.checkRateLimit("a");
    limiter.checkRateLimit("b");
    expect(limiter.activeClients).toBe(2);
  });

  it("resetLimits sets activeClients back to zero", () => {
    const limiter = new RateLimiter(60, 5);
    limiter.checkRateLimit("a");
    limiter.resetLimits();
    expect(limiter.activeClients).toBe(0);
  });

  it("allows high burst without deny", () => {
    const limiter = new RateLimiter(600, 10);
    const results = Array.from({ length: 10 }, () =>
      limiter.checkRateLimit("highburst")
    );
    expect(results.every((r) => r.allowed)).toBe(true);
  });

  it("retry_after_ms is at most the refill interval", () => {
    const limiter = new RateLimiter(60, 1);
    limiter.checkRateLimit("c");
    const result = limiter.checkRateLimit("c");
    expect(result.allowed).toBe(false);
    // At 60 rpm, refill interval is 1000ms
    expect(result.retry_after_ms).toBeLessThanOrEqual(1000);
  });
});
