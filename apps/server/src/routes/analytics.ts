import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { FilterError, parseFilters } from "../analytics/filters.js";
import { analyticsModules, getModule } from "../analytics/registry.js";
import { requireAuth } from "./auth.js";
import type { TableData } from "../analytics/types.js";

function toCsv(table: TableData): string {
  const esc = (v: string | number | null): string => {
    if (v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.columns.map(esc).join(",")];
  for (const row of table.rows) lines.push(row.map(esc).join(","));
  return lines.join("\r\n");
}

export function registerAnalyticsRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = requireAuth(ctx);

  app.get("/api/v1/analytics/modules", { preHandler: auth }, async () => ({
    modules: analyticsModules.map((m) => ({ id: m.id, title: m.title, requiredMode: m.requiredMode ?? null }))
  }));

  app.get("/api/v1/analytics/:module", { preHandler: auth }, async (request, reply) => {
    const { module: moduleId } = request.params as { module: string };
    const mod = getModule(moduleId);
    if (!mod) return reply.code(404).send({ error: "unknown_module" });
    try {
      const filters = parseFilters(request.query as Record<string, unknown>);
      return await mod.query(ctx, filters);
    } catch (err) {
      if (err instanceof FilterError) {
        return reply.code(400).send({ error: "invalid_filters", detail: err.message });
      }
      throw err;
    }
  });

  /**
   * CSV export of a module table. Contains only aggregated table data;
   * visitor/session identifiers are never part of dashboard exports.
   */
  app.get("/api/v1/analytics/:module/export", { preHandler: auth }, async (request, reply) => {
    const { module: moduleId } = request.params as { module: string };
    const { table: tableName } = request.query as { table?: string };
    const mod = getModule(moduleId);
    if (!mod) return reply.code(404).send({ error: "unknown_module" });
    if (!tableName) return reply.code(400).send({ error: "table parameter required" });
    try {
      const filters = parseFilters(request.query as Record<string, unknown>);
      const result = await mod.query(ctx, filters);
      const table = result.tables?.[tableName];
      if (!table) return reply.code(404).send({ error: "unknown_table" });
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="lumly-${moduleId}-${tableName}.csv"`);
      return reply.send(toCsv(table));
    } catch (err) {
      if (err instanceof FilterError) {
        return reply.code(400).send({ error: "invalid_filters", detail: err.message });
      }
      throw err;
    }
  });
}
