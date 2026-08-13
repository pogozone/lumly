import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { Pool } from "../db.js";
import { execute, query } from "../db.js";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export interface SessionInfo {
  sessionId: string;
  userId: number;
  email: string;
  csrfToken: string;
  expiresAt: Date;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function createUser(pool: Pool, email: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await execute(
    pool,
    "INSERT INTO dashboard_users (email, password_hash) VALUES (:email, :hash)",
    { email: email.toLowerCase(), hash }
  );
}

export async function userCount(pool: Pool): Promise<number> {
  const rows = await query<{ n: number }>(pool, "SELECT COUNT(*) AS n FROM dashboard_users");
  return Number(rows[0]?.n ?? 0);
}

export async function login(
  pool: Pool,
  email: string,
  password: string
): Promise<SessionInfo | null> {
  const rows = await query<{ id: number; email: string; password_hash: string }>(
    pool,
    "SELECT id, email, password_hash FROM dashboard_users WHERE email = :email",
    { email: email.toLowerCase() }
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return null;

  const sessionId = randomBytes(16).toString("hex");
  const csrfToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await execute(
    pool,
    "INSERT INTO dashboard_sessions (id, user_id, csrf_token, expires_at) VALUES (:id, :uid, :csrf, :exp)",
    { id: sessionId, uid: user.id, csrf: csrfToken, exp: expiresAt }
  );
  await execute(pool, "UPDATE dashboard_users SET last_login_at = NOW(3) WHERE id = :id", { id: user.id });
  return { sessionId, userId: user.id, email: user.email, csrfToken, expiresAt };
}

export async function getSession(pool: Pool, sessionId: string): Promise<SessionInfo | null> {
  const rows = await query<{
    id: string;
    user_id: number;
    email: string;
    csrf_token: string;
    expires_at: Date;
  }>(
    pool,
    `SELECT s.id, s.user_id, s.csrf_token, s.expires_at, u.email
     FROM dashboard_sessions s JOIN dashboard_users u ON u.id = s.user_id
     WHERE s.id = :id AND s.expires_at > NOW(3)`,
    { id: sessionId }
  );
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    userId: row.user_id,
    email: row.email,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at
  };
}

export async function logout(pool: Pool, sessionId: string): Promise<void> {
  await execute(pool, "DELETE FROM dashboard_sessions WHERE id = :id", { id: sessionId });
}

export async function pruneExpiredSessions(pool: Pool): Promise<void> {
  await execute(pool, "DELETE FROM dashboard_sessions WHERE expires_at < NOW(3)");
}
