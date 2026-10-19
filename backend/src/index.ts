import express from "express";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db.js";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(router);

// Any error thrown in a route ends up here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Server error. Look at the backend terminal for details." });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Check the database connection once at the start, so a wrong password shows up immediately.
pool
  .query("SELECT 1")
  .then(() => console.log("Connected to MySQL"))
  .catch((e: Error) => console.error("Cannot connect to MySQL. Check backend/.env and that MySQL is running.", e.message));