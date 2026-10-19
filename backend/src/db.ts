import "dotenv/config";
import { createPool } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

// A pool keeps a few connections open and reuses them, which is faster than reconnecting each time.
export const pool = createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "duty_platform",
  dateStrings: true, // dates come back as text like "2026-10-07", not as Date objects
  connectionLimit: 10,
});

// Reads rows (SELECT). The ? marks are filled from params, which keeps the query safe from injection.
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

// Changes data (INSERT, UPDATE, DELETE).
export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.query<ResultSetHeader>(sql, params);
  return result;
}