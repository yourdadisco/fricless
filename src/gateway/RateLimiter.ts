export interface RateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private config: RateLimitConfig) {}

  consume(key: string, tokens: number = 1): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.burstSize, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill based on elapsed time
    const elapsedMs = now - bucket.lastRefill;
    const refillRate = this.config.requestsPerMinute / 60000; // tokens per ms
    const refillTokens = elapsedMs * refillRate;
    bucket.tokens = Math.min(this.config.burstSize, bucket.tokens + refillTokens);
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return { allowed: true };
    }

    const deficit = tokens - bucket.tokens;
    const retryAfterMs = Math.ceil(deficit / refillRate);
    return { allowed: false, retryAfterMs };
  }

  getRemainingTokens(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket?.tokens ?? this.config.burstSize;
  }

  cleanExpired(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > 60000) {
        this.buckets.delete(key);
      }
    }
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}
