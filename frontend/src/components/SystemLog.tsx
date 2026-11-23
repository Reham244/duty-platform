import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getSystemLog, getUsers } from "../api";
import type { SystemLogEntry, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 6, textAlign: "left", verticalAlign: "top", fontSize: 13 };

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const levelColour: Record<SystemLogEntry["level"], string> = { info: "#1b6fd1", warn: "#b5651d", error: "#a63a2b" };
const levelLabel: Record<SystemLogEntry["level"], string> = { info: "Info", warn: "Warning", error: "Error" };
const sourceLabel: Record<string, string> = { http: "API request", db: "Database", scheduler: "Scheduler", app: "App" };
const statusColour = (s: number) => (s >= 500 ? "#a63a2b" : s >= 400 ? "#b5651d" : "#1f7a4d");

export default function SystemLog() {
  const [people, setPeople] = useState<User[]>([]);
  const [from, setFrom] = useState(isoDaysAgo(1));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [method, setMethod] = useState("");
  const [user, setUser] = useState("");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [rows, setRows] = useState<SystemLogEntry[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    getUsers().then(setPeople);
  }, []);

  useEffect(() => {
    getSystemLog({ from, to, level, source, method, user, q: search }, live).then(setRows);
  }, [from, to, level, source, method, user, search, version, live]);

  // Live mode: reload every 10 seconds.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setVersion((v) => v + 1), 10000);
    return () => clearInterval(timer);
  }, [live]);

  const http = rows.filter((r) => r.source === "http");
  const serverErrors = http.filter((r) => (r.status ?? 0) >= 500).length;
  const clientErrors = http.filter((r) => (r.status ?? 0) >= 400 && (r.status ?? 0) < 500).length;
  const timed = http.filter((r) => r.durationMs !== null);
  const average = timed.length === 0 ? 0 : Math.round(timed.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / timed.length);
  const slowest = timed.reduce((max, r) => Math.max(max, r.durationMs ?? 0), 0);

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Time", "Level", "Source", "Method", "Path", "Status", "Milliseconds", "Person", "Message", "Details"];
    const lines = rows.map((r) =>
      [
        r.createdAt, r.level, r.source, r.method ?? "", r.path ?? "", String(r.status ?? ""), String(r.durationMs ?? ""),
        r.userName ?? "", r.message, r.details ?? "",
      ]
        .map(esc)
        .join(","),
    );
    const csv = "\ufeff" + [header.map(esc).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-log-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const box = (label: string, value: string, color = "#0f4c8a") => (
    <div style={{ flex: 1, minWidth: 130, border: "1px solid #d9e0e7", borderRadius: 10, padding: 10, background: "white" }}>
      <div style={{ color: "#6b7a90", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <label>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Level{" "}
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All</option>
            <option value="problems">Warnings and errors</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label>
          Source{" "}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {Object.entries(sourceLabel).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Method{" "}
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All</option>
            {["GET", "POST", "PUT", "DELETE"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Person{" "}
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </label>
        <label>
          Search <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Address or words" />
        </label>
        <label>
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live (every 10 s)
        </label>
        <button onClick={() => setVersion((v) => v + 1)}>Refresh</button>
        <button onClick={exportCsv} disabled={rows.length === 0}>Export (CSV)</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {box("Lines shown", String(rows.length))}
        {box("API requests", String(http.length))}
        {box("Server errors (5xx)", String(serverErrors), serverErrors ? "#a63a2b" : "#1f7a4d")}
        {box("Refused or invalid (4xx)", String(clientErrors), clientErrors ? "#b5651d" : "#1f7a4d")}
        {box("Average time", `${average} ms`)}
        {box("Slowest", `${slowest} ms`, slowest > 1000 ? "#b5651d" : "#0f4c8a")}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          Nothing logged for these filters.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
            <thead>
              <tr>
                <th style={{ ...cell, width: 170 }}>Time</th>
                <th style={{ ...cell, width: 80 }}>Level</th>
                <th style={{ ...cell, width: 100 }}>Source</th>
                <th style={cell}>What happened</th>
                <th style={{ ...cell, width: 60 }}>Status</th>
                <th style={{ ...cell, width: 70 }}>Time</th>
                <th style={{ ...cell, width: 130 }}>Person</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  style={{ cursor: r.details ? "pointer" : "default", background: r.level === "info" ? "white" : r.level === "warn" ? "#fffaf2" : "#fff5f3" }}
                >
                  <td style={cell}>{r.createdAt}</td>
                  <td style={{ ...cell, color: levelColour[r.level], fontWeight: 700 }}>{levelLabel[r.level]}</td>
                  <td style={cell}>{sourceLabel[r.source] ?? r.source}</td>
                  <td style={cell}>
                    {r.message}
                    {open === r.id && r.details && (
                      <pre style={{ background: "#f3f6fa", padding: 8, borderRadius: 6, fontSize: 12, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>
                        {r.details}
                      </pre>
                    )}
                  </td>
                  <td style={{ ...cell, fontWeight: 700, color: r.status ? statusColour(r.status) : "#6b7a90" }}>{r.status ?? ""}</td>
                  <td style={cell}>{r.durationMs !== null ? `${r.durationMs} ms` : ""}</td>
                  <td style={cell}>{r.userName ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        The system log is for finding problems: API requests with their time, errors with their details (click a row),
        and scheduled jobs. Lines older than the retention period are removed automatically. Frequent background checks
        are logged only when they fail.
      </p>
    </div>
  );
}