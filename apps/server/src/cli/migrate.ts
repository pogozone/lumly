import { loadConfig } from "../config.js";
import { createPool } from "../db.js";
import { runMigrations } from "../migrate.js";

const config = loadConfig();
const pool = createPool(config);
try {
  await runMigrations(pool, config.migrationsDir, (m) => console.info(`[migrate] ${m}`));
  console.info("Migrations complete");
} finally {
  await pool.end();
}
