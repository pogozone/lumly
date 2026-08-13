import { loadConfig } from "../config.js";
import { createPool } from "../db.js";
import { runMigrations } from "../migrate.js";
import { createUser, userCount } from "../services/auth.js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: pnpm create-admin <email> <password>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const config = loadConfig();
const pool = createPool(config);
try {
  await runMigrations(pool, config.migrationsDir, () => {});
  await createUser(pool, email, password);
  console.info(`Admin user created: ${email.toLowerCase()} (${await userCount(pool)} users total)`);
} finally {
  await pool.end();
}
