import type { AnalyticsFilters } from "@lumly/shared";
import type { AppContext } from "../context.js";

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface ModuleResult {
  kpis?: Record<string, number | null>;
  series?: Array<Record<string, string | number | null>>;
  tables?: Record<string, TableData>;
  /** Extra metadata, e.g. availability flags for consented-only metrics. */
  meta?: Record<string, unknown>;
}

/**
 * Contract for analytics modules. A new module needs: a query function here,
 * a response view in the dashboard and a navigation registration.
 */
export interface AnalyticsModule {
  id: string;
  title: string;
  /** Metrics only computable in consented mode must be flagged by the module. */
  requiredMode?: "basic" | "consented";
  query(ctx: AppContext, f: AnalyticsFilters): Promise<ModuleResult>;
}
