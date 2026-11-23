import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getAuditLog, getUsers } from "../api";
import type { AuditEntry, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left", verticalAlign: "top", fontSize: 14 };

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const actions: Record<string, { label: string; colour: string }> = {
  "attendance.mark": { label: "Attendance", colour: "#1f7a4d" },
  "substitution.request": { label: "Substitution request", colour: "#a63a2b" },
  "substitution.add": { label: "Substitution added", colour: "#7a4fb0" },
  "duty.add": { label: "Duty added", colour: "#1b6fd1" },
  "duty.delete": { label: "Duty removed", colour: "#b5651d" },
  "dutytype.add": { label: "Duty type added", colour: "#1b6fd1" },
  "role.change": { label: "Role changed", colour: "#0f4c8a" },
  "notify.send": { label: "Notifications sent", colour: "#3a8aa0" },
  "reminders.run": { label: "Reminder check", colour: "#3a8aa0" },
  "reminders.auto": { label: "Automatic reminders", colour: "#3a8aa0" },
  "stats.view": { label: "Statistics viewed", colour: "#6b7a90" },
  "access.denied": { label: "Access denied", colour: "#a63a2b" },
};

const outcomeColour: Record<AuditEntry["outcome"], string> = { ok: "#1f7a4d", denied: "#a63a2b", error: "#b5651d" };
const outcomeLabel: Record<AuditEntry["outcome"], string> = { ok: "Done", denied: "Denied", error: "Error" };

export default function ActivityLog() {
  const [people, setPeople] = useState<User[]>([]);
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    getUsers().then(setPeople);
  }, []);

  useEffect(() => {
    getAuditLog({ from, to, actor, action, q: search }).then(setRows);
  }, [from, to, actor, action, search, version]);

  const denied = rows.filter((r) => r.outcome !== "ok").length;

  // Downloads what is on screen as a file that opens in Excel.
  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Time", "Person", "Role", "Action", "What happened", "Result", "Details"];
    const lines = rows.map((r) =>
      [r.createdAt, r.actorName, r.actorRole ?? "", r.action, r.summary, outcomeLabel[r.outcome], r.details ?? ""]
        .map(esc)
        .join(","),
    );
    const csv = "\ufeff" + [header.map(esc).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-log-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Person{" "}
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            <option value="system">System (automatic)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </label>
        <label>
          Action{" "}
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {Object.entries(actions).map(([code, a]) => (
              <option key={code} value={code}>{a.label}</option>
            ))}
          </select>
        </label>
        <label>
          Search <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or words" />
        </label>
        <button onClick={() => setVersion((v) => v + 1)}>Refresh</button>
        <button onClick={exportCsv} disabled={rows.length === 0}>Export to Excel (CSV)</button>
      </div>

      <div style={{ color: "#6b7a90", marginBottom: 10 }}>
        {rows.length} {rows.length === 1 ? "entry" : "entries"}, newest first
        {rows.length >= 300 && " (the latest 300; narrow the dates to see older ones)"}
        {denied > 0 && <b style={{ color: "#a63a2b" }}> · {denied} denied or failed</b>}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          Nothing logged for these filters.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
          <thead>
            <tr>
              <th style={{ ...cell, width: 150 }}>Time</th>
              <th style={{ ...cell, width: 170 }}>Person</th>
              <th style={{ ...cell, width: 160 }}>Action</th>
              <th style={cell}>What happened</th>
              <th style={{ ...cell, width: 80 }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = actions[r.action] ?? { label: r.action, colour: "#6b7a90" };
              return (
                <tr
                  key={r.id}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  style={{ cursor: r.details ? "pointer" : "default", background: r.outcome === "ok" ? "white" : "#fff5f3" }}
                >
                  <td style={cell}>{r.createdAt}</td>
                  <td style={cell}>
                    <b>{r.actorName}</b>
                    {r.actorRole && <div style={{ color: "#6b7a90", fontSize: 12 }}>{r.actorRole}</div>}
                  </td>
                  <td style={cell}>
                    <span style={{ background: a.colour, color: "white", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {a.label}
                    </span>
                  </td>
                  <td style={cell}>
                    {r.summary}
                    {open === r.id && r.details && (
                      <pre style={{ background: "#f3f6fa", padding: 8, borderRadius: 6, fontSize: 12, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>
                        {r.details}
                      </pre>
                    )}
                  </td>
                  <td style={{ ...cell, color: outcomeColour[r.outcome], fontWeight: 700 }}>{outcomeLabel[r.outcome]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        The log only grows: nothing in the platform edits or deletes an entry. Click a row to see the raw details.
        Ordinary screen views and reading notifications are not logged.
      </p>
    </div>
  );
}