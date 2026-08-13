import mysql from "mysql2/promise";
import type { ServerConfig } from "./config.js";

export type Pool = mysql.Pool;
export type Row = Record<string, unknown>;

export function createPool(config: ServerConfig): Pool {
  return mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false
  });
}

export async function query<T = Row>(
  pool: Pool,
  sql: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const [rows] = await pool.query(sql, params as mysql.QueryOptions["values"]);
  return rows as T[];
}

export async function execute(
  pool: Pool,
  sql: string,
  params: Record<string, unknown> = {}
): Promise<{ affectedRows: number; insertId: number }> {
  const [result] = await pool.query(sql, params as mysql.QueryOptions["values"]);
  const r = result as mysql.ResultSetHeader;
  return { affectedRows: r.affectedRows, insertId: Number(r.insertId) };
}
