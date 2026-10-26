import type { CSSProperties } from "react";
import type { Duty, DutyTypeInfo } from "../types";
import { DutyBlock } from "./DutyBlock";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, verticalAlign: "top", textAlign: "left", fontSize: 14 };

interface WeekTimetableProps {
  duties: Duty[];
  types: DutyTypeInfo[];
  todayDay?: number | undefined;
}

// The whole week as a table: times down the left, days across the top, each duty in its cell.
export default function WeekTimetable({ duties, types, todayDay }: WeekTimetableProps) {
  const typeOf = (code: string) => types.find((t) => t.code === code);
  const slots = [...new Set(duties.map((d) => `${d.start}|${d.end}`))].sort();

  if (slots.length === 0) {
    return (
      <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 20, color: "#6b7a90", textAlign: "center" }}>
        No duties this week.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 840, tableLayout: "fixed", background: "white" }}>
        <thead>
          <tr>
            <th style={{ ...cell, width: 120 }}>Time</th>
            {days.map((name, i) => (
              <th key={name} style={cell}>
                {name}
                {i === todayDay && <div style={{ fontWeight: 400, fontSize: 12, color: "#1b6fd1" }}>today</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const [start = "", end = ""] = slot.split("|");
            return (
              <tr key={slot}>
                <td style={{ ...cell, fontWeight: 700 }}>{start} to {end}</td>
                {days.map((name, i) => (
                  <td key={name} style={{ ...cell, background: i === todayDay ? "#eaf3ff" : "white" }}>
                    {duties
                      .filter((d) => d.day === i && d.start === start && d.end === end)
                      .map((d) => {
                        const t = typeOf(d.type);
                        const colour = t?.colour ?? "#6b7a90";
                        return (
                          <DutyBlock key={d.id} colour={colour}>
                            <b style={{ color: colour }}>{t?.name ?? d.type}</b>
                            <br />
                            <b>{d.place}</b>
                            <br />
                            <small>{d.stage}</small>
                          </DutyBlock>
                        );
                      })}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}