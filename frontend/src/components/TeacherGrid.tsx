import { useState } from "react";
import type { CSSProperties } from "react";
import type { Duty, DutyTypeInfo, User } from "../types";
import { DutyBlock } from "./DutyBlock";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 6, verticalAlign: "top", textAlign: "left", fontSize: 13 };

const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};
const hoursOf = (d: Duty) => (toMin(d.end) - toMin(d.start)) / 60;

interface TeacherGridProps {
  duties: Duty[];
  types: DutyTypeInfo[];
  people: User[];
  showStage: boolean;
  onRemove?: ((dutyId: number) => void) | undefined;
}

// Teachers down the side, days across, with each teacher's weekly load. Useful for fairness checks.
export default function TeacherGrid({ duties, types, people, showStage, onRemove }: TeacherGridProps) {
  const [showEmpty, setShowEmpty] = useState(false);
  const typeOf = (code: string) => types.find((t) => t.code === code);
  const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

  const ids = new Set(duties.map((d) => d.userId));
  if (showEmpty) people.filter((p) => p.role === "teacher").forEach((p) => ids.add(p.id));
  const rows = [...ids]
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is User => p !== undefined)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const load = (id: number) => {
    const mine = duties.filter((d) => d.userId === id);
    return { count: mine.length, hours: mine.reduce((sum, d) => sum + hoursOf(d), 0) };
  };
  const maxHours = Math.max(1, ...rows.map((p) => load(p.id).hours));

  return (
    <div>
      <label style={{ display: "inline-block", marginBottom: 10, fontSize: 14 }}>
        <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show teachers
        without duties
      </label>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 960, background: "white" }}>
          <thead>
            <tr>
              <th style={{ ...cell, width: 150 }}>Teacher</th>
              {days.map((name) => (
                <th key={name} style={cell}>{name}</th>
              ))}
              <th style={{ ...cell, width: 150 }}>Weekly load</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const l = load(p.id);
              return (
                <tr key={p.id}>
                  <td style={cell}>
                    <b>{p.fullName}</b>
                    <br />
                    <small style={{ color: "#6b7a90" }}>{p.subject}</small>
                  </td>
                  {days.map((name, i) => (
                    <td key={name} style={cell}>
                      {duties
                        .filter((d) => d.userId === p.id && d.day === i)
                        .sort(byTime)
                        .map((d) => {
                          const t = typeOf(d.type);
                          const colour = t?.colour ?? "#6b7a90";
                          return (
                            <DutyBlock key={d.id} colour={colour}>
                              <b style={{ color: colour }}>{t?.name ?? d.type}</b> <small>{d.start}</small>
                              <br />
                              <small>
                                {showStage && <b>{d.stage}: </b>}
                                {d.place}
                              </small>
                              {onRemove && (
                                <>
                                  {" "}
                                  <button onClick={() => onRemove(d.id)} aria-label="Remove duty" title="Remove duty">×</button>
                                </>
                              )}
                            </DutyBlock>
                          );
                        })}
                    </td>
                  ))}
                  <td style={cell}>
                    <b>{l.hours.toFixed(1)} h</b> <small style={{ color: "#6b7a90" }}>{l.count} duties</small>
                    <div style={{ height: 6, background: "#e3e8ee", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(l.hours / maxHours) * 100}%`, height: "100%", background: "#1b6fd1" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p style={{ color: "#6b7a90" }}>No teachers to show.</p>}
    </div>
  );
}