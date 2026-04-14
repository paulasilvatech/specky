/**
 * RateLimiter — Token bucket rate limiting for HTTP transport.
 * No external dependencies — uses built-in timing.
 *
 * Only active when rate_limit.enabled=true in .specky/config.yml AND
 * the server is running in HTTP mode (--http flag). stdio mode bypasses
 * rate limiting because stdio is inherently single-session.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets: Map<string, TokenBucket> = new Map();
  private readonly refillIntervalMs: number;

  constructor(
    _maxRpm: number,
    private readonly burst: number,
  ) {
    // Tokens refill at a rate of maxRpm per minute
    this.refillIntervalMs = 60_000 / _maxRpm;
  }

  /**
   * Check whether a request from the given clientId is allowed.
   * Returns allowed:true and consumes one token, or allowed:false
   * with retry_after_ms indicating when the next token will be available.
   */
  checkRateLimit(clientId: string): { allowed: boolean; retry_after_ms?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      // New client — start with a full burst
      bucket = { tokens: this.burst, lastRefill: now };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.burst, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate when the next token will be available
    const msUntilNextToken = this.refillIntervalMs - (elapsed % this.refillIntervalMs);
    return { allowed: false, retry_after_ms: Math.ceil(msUntilNextToken) };
  }

  /**
   * Reset all token buckets. Useful for testing and graceful restarts.
   */
  resetLimits(): void {
    this.buckets.clear();
  }

  /**
   * Return the number of active tracked clients (for observability).
   */
  get activeClients(): number {
    return this.buckets.size;
  }
}
