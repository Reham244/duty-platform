import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getStages, getStats } from "../api";
import type { StatsRow } from "../api";
import type { StageName, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left" };

function rateColour(rate: number): string {
  if (rate >= 85) return "#1f7a4d";
  if (rate >= 70) return "#b5651d";
  return "#a63a2b";
}

export default function Statistics({ user }: { user: User }) {
  const locked = user.role === "head_of_stage";
  const [stages, setStages] = useState<StageName[]>([]);
  const [stage, setStage] = useState<StageName | "all">(user.homeStage ?? "all");
  const [from, setFrom] = useState("2026-09-09");
  const [to, setTo] = useState("2026-10-07");
  const [rows, setRows] = useState<StatsRow[]>([]);

  useEffect(() => {
    getStages().then(setStages);
  }, []);

  useEffect(() => {
    getStats(stage, from, to).then(setRows);
  }, [stage, from, to]);

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalMarked = rows.reduce((sum, r) => sum + r.marked, 0);
  const averageHours = rows.length === 0 ? 0 : totalHours / rows.length;
  const maxHours = Math.max(1, ...rows.map((r) => r.hours));

  const box = (label: string, value: string) => (
    <div style={{ flex: 1, minWidth: 140, border: "1px solid #d9e0e7", borderRadius: 10, padding: 12, background: "white" }}>
      <div style={{ color: "#6b7a90", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0f4c8a" }}>{value}</div>
    </div>
  );

  return (
    <div>
      <h2>{locked ? "Stage statistics" : "All stages statistics"}</h2>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Stage{" "}
          <select
            value={stage}
            disabled={locked}
            onChange={(e) => setStage(e.target.value as StageName | "all")}
          >
            {!locked && <option value="all">All stages</option>}
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {box("People", String(rows.length))}
        {box("Duties marked", String(totalMarked))}
        {box("Total hours on duty", totalHours.toFixed(1))}
        {box("Average hours per person", averageHours.toFixed(1))}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          No marked duties in this period.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
          <thead>
            <tr>
              <th style={cell}>Teacher</th>
              <th style={cell}>Attended</th>
              <th style={cell}>Late</th>
              <th style={cell}>Missed</th>
              <th style={cell}>Attendance rate</th>
              <th style={cell}>Hours on duty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.person.id}>
                <td style={cell}>
                  <b>{r.person.fullName}</b> {r.person.subject && <small>({r.person.subject})</small>}
                </td>
                <td style={cell}>{r.present}</td>
                <td style={{ ...cell, color: r.late ? "#b5651d" : undefined }}>{r.late}</td>
                <td style={{ ...cell, color: r.absent ? "#a63a2b" : undefined }}>{r.absent}</td>
                <td style={{ ...cell, color: rateColour(r.rate), fontWeight: 700 }}>{r.rate}%</td>
                <td style={cell}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 120, height: 10, background: "#e3e8ee", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${(r.hours / maxHours) * 100}%`, height: "100%", background: "#1b6fd1" }} />
                    </div>
                    <b>{r.hours.toFixed(1)}</b>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        Duties that are not marked yet are not counted. Attendance rate = present divided by all marked duties.
        Hours count when the person was present or late.
      </p>
    </div>
  );
}