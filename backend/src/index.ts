import express from "express";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db.js";
import { startReminders } from "./reminders.js";
import { router } from "./routes.js";
import { logSystem, requestLogger } from "./systemLog.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(router);

// Any error thrown in a route ends up here. It is written to the system log with its details.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const e = err as { message?: string; stack?: string; code?: string; sqlMessage?: string };
  logSystem("error", "app", e.message ?? "Unhandled error", {
    method: req.method,
    path: req.originalUrl,
    details: { code: e.code, sqlMessage: e.sqlMessage, stack: e.stack },
  });
  res.status(500).json({ error: "Server error. Look at the backend terminal for details." });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  logSystem("info", "app", `Backend started on port ${PORT}`);
});

// Check the database connection once at the start, so a wrong password shows up immediately.
pool
  .query("SELECT 1")
  .then(() => {
    console.log("Connected to MySQL");
    logSystem("info", "db", "Connected to MySQL");
    startReminders();
  })
  .catch((e: Error) => console.error("Cannot connect to MySQL. Check backend/.env and that MySQL is running.", e.message));