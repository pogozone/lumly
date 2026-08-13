/**
 * In-memory sliding-window rate limiter. Keys (e.g. client IPs for the
 * public collector) live only in process memory with a short TTL and are
 * never written to the database or logs.
 */
export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
    setInterval(() => this.sweep(), windowMs).unref();
  }

  allow(key: string): boolean {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    b.count += 1;
    return b.count <= this.max;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.buckets) {
      if (v.resetAt <= now) this.buckets.delete(k);
    }
  }
}
