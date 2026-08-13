import { loadConfig } from "../config.js";
import { createPool } from "../db.js";
import { runMigrations } from "../migrate.js";
import { seedDemoData } from "../services/seed.js";

const config = loadConfig();
const pool = createPool(config);
try {
  await runMigrations(pool, config.migrationsDir, (m) => console.info(`[migrate] ${m}`));
  await seedDemoData(pool, (m) => console.info(`[seed] ${m}`));
} finally {
  await pool.end();
}
