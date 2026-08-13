import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "./db.js";
import { query } from "./db.js";

/**
 * Append-only forward migrations. Applied versions are recorded in
 * schema_migrations; released migration files must never be edited.
 */
export async function runMigrations(pool: Pool, migrationsDir: string, log: (msg: string) => void): Promise<void> {
  // MariaDB advisory lock prevents concurrent migration runs.
  const [lock] = await query<{ got: number }>(pool, "SELECT GET_LOCK('lumly_migrate', 30) AS got");
  if (!lock || Number(lock.got) !== 1) {
    throw new Error("Could not acquire migration lock");
  }
  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INT UNSIGNED NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB"
    );
    const applied = new Set(
      (await query<{ version: number }>(pool, "SELECT version FROM schema_migrations")).map((r) => Number(r.version))
    );
    const files = (await readdir(migrationsDir))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();
    for (const file of files) {
      const version = Number(file.split("_")[0]);
      if (applied.has(version)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      const statements = splitStatements(sql);
      for (const stmt of statements) {
        await pool.query(stmt);
      }
      await pool.query("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
      log(`Applied migration ${file}`);
    }
  } finally {
    await pool.query("SELECT RELEASE_LOCK('lumly_migrate')");
  }
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^--[^\n]*$/gm, "").trim())
    .filter((s) => s.length > 0);
}
