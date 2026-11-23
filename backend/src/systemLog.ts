import type { NextFunction, Request, Response } from "express";
import { query, run } from "./db.js";
import type { SystemLogEntry, User } from "./types.js";

export type LogLevel = "info" | "warn" | "error";
export type LogSource = "http" | "db" | "scheduler" | "app";

interface Extra {
  method?: string | undefined;
  path?: string | undefined;
  status?: number | undefined;
  durationMs?: number | undefined;
  userId?: number | undefined;
  details?: unknown;
}

export async function writeSystemLog(level: LogLevel, source: LogSource, message: string, extra: Extra = {}): Promise<void> {
  const details = extra.details === undefined ? null : JSON.stringify(extra.details).slice(0, 4000);
  await run(
    `INSERT INTO system_log (level, source, method, path, status, duration_ms, user_id, message, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      level, source, extra.method ?? null, extra.path?.slice(0, 300) ?? null, extra.status ?? null,
      extra.durationMs ?? null, extra.userId ?? null, message.slice(0, 500), details,
    ],
  );
}

// Fire and forget: writing a log line must never break what is being logged.
export function logSystem(level: LogLevel, source: LogSource, message: string, extra?: Extra): void {
  writeSystemLog(level, source, message, extra).catch((e: Error) => console.error("Could not write the system log:", e.message));
}

// Addresses that are called all the time. They are logged only when they fail.
const QUIET = ["/notifications/unread-count", "/health", "/logs/"];

// Logs every request: method, address, status and how long it took.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    const path = req.originalUrl;
    if (res.statusCode < 400 && QUIET.some((q) => path.startsWith(q))) return;
    const user = res.locals.user as User | undefined;
    const level: LogLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logSystem(level, "http", `${req.method} ${path} ${res.statusCode}`, {
      method: req.method, path, status: res.statusCode, durationMs: Date.now() - started, userId: user?.id,
    });
  });
  next();
}

export interface SystemLogFilter {
  from: string;
  to: string;
  level: string; // info, warn, error, "problems" (warnings and errors), or ""
  source: string;
  method: string;
  user: string;
  q: string;
  limit: number;
}

export async function getSystemLog(f: SystemLogFilter): Promise<SystemLogEntry[]> {
  const where: string[] = ["l.created_at >= ?", "l.created_at < DATE_ADD(?, INTERVAL 1 DAY)"];
  const params: unknown[] = [f.from, f.to];
  if (f.level === "problems") {
    where.push("l.level IN ('warn', 'error')");
  } else if (f.level) {
    where.push("l.level = ?");
    params.push(f.level);
  }
  if (f.source) {
    where.push("l.source = ?");
    params.push(f.source);
  }
  if (f.method) {
    where.push("l.method = ?");
    params.push(f.method);
  }
  if (f.user) {
    where.push("l.user_id = ?");
    params.push(Number(f.user));
  }
  if (f.q) {
    where.push("(l.message LIKE ? OR l.path LIKE ?)");
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  return query<SystemLogEntry>(
    `SELECT l.id AS id, l.created_at AS createdAt, l.level AS level, l.source AS source, l.method AS method,
            l.path AS path, l.status AS status, l.duration_ms AS durationMs, l.user_id AS userId,
            u.full_name AS userName, l.message AS message, l.details AS details
     FROM system_log l LEFT JOIN users u ON u.id = l.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY l.id DESC
     LIMIT ?`,
    [...params, f.limit],
  );
}

// Old system log lines are removed so the table does not grow forever. The audit log is never purged.
export async function purgeSystemLog(days: number): Promise<number> {
  const result = await run("DELETE FROM system_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)", [days]);
  return result.affectedRows;
}