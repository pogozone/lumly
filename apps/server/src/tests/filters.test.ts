import { describe, expect, it } from "vitest";
import { FilterError, parseFilters, pctChange, whereClause } from "../analytics/filters.js";
import { RateLimiter } from "../lib/rateLimit.js";

describe("analytics filters", () => {
  it("parses presets", () => {
    const f = parseFilters({ site: "s1", range: "7d" });
    expect(f.site).toBe("s1");
    expect(new Date(f.to).getTime() - new Date(f.from).getTime()).toBeGreaterThan(6 * 864e5);
  });

  it("requires site", () => {
    expect(() => parseFilters({})).toThrow(FilterError);
  });

  it("rejects inverted ranges", () => {
    expect(() =>
      parseFilters({ site: "s1", range: "custom", from: "2026-08-10", to: "2026-08-01" })
    ).toThrow(FilterError);
  });

  it("parameterizes all values in the where clause", () => {
    const f = parseFilters({ site: "s1", path: "/x'; DROP TABLE events;--", mode: "basic" });
    const { sql, params } = whereClause(f);
    expect(sql).not.toContain("DROP");
    expect(params.path).toBe("/x'; DROP TABLE events;--");
    expect(params.mode).toBe("basic");
  });

  it("excludes bots by default", () => {
    const f = parseFilters({ site: "s1" });
    expect(whereClause(f).sql).toContain("is_bot = 0");
    const fb = parseFilters({ site: "s1", includeBots: "true" });
    expect(whereClause(fb).sql).not.toContain("is_bot");
  });

  it("handles division by zero in comparisons", () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(15, 10)).toBe(50);
    expect(pctChange(10, null)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.allow("k")).toBe(true);
    expect(rl.allow("k")).toBe(true);
    expect(rl.allow("k")).toBe(true);
    expect(rl.allow("k")).toBe(false);
    expect(rl.allow("other")).toBe(true);
  });
});
