import type { Pool } from "../db.js";
import { execute, query } from "../db.js";
import { rebuildDaily, rebuildHourly } from "./aggregate.js";

const DELETE_CHUNK = 5000;

/**
 * Retention enforcement. Raw events older than a site's retention window are
 * deleted in bounded chunks. Rollups are rebuilt for the affected range
 * first so non-identifying aggregates survive raw deletion.
 */
export async function runRetention(pool: Pool, log: (msg: string) => void): Promise<void> {
  const sites = await query<{ id: string; retention_days: number }>(
    pool,
    "SELECT id, retention_days FROM sites"
  );
  for (const site of sites) {
    const cutoff = new Date(Date.now() - Number(site.retention_days) * 24 * 3600 * 1000);

    const range = await query<{ min_ts: Date | null }>(
      pool,
      "SELECT MIN(occurred_at) AS min_ts FROM events WHERE site_id = :site AND occurred_at < :cutoff",
      { site: site.id, cutoff }
    );
    const oldest = range[0]?.min_ts ?? null;
    if (oldest) {
      await rebuildHourly(pool, site.id, new Date(oldest), cutoff);
      const dayStart = new Date(oldest);
      dayStart.setHours(0, 0, 0, 0);
      await rebuildDaily(pool, site.id, dayStart, cutoff);
    }

    let deleted = 0;
    for (;;) {
      const res = await execute(
        pool,
        "DELETE FROM events WHERE site_id = :site AND occurred_at < :cutoff ORDER BY id LIMIT :chunk",
        { site: site.id, cutoff, chunk: DELETE_CHUNK }
      );
      deleted += res.affectedRows;
      if (res.affectedRows < DELETE_CHUNK) break;
    }
    await execute(
      pool,
      "INSERT INTO retention_log (site_id, deleted_events) VALUES (:site, :deleted)",
      { site: site.id, deleted }
    );
    if (deleted > 0) log(`Retention: deleted ${deleted} events for site ${site.id}`);
  }
}
