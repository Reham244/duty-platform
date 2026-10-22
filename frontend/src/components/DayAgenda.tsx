import { useState } from "react";
import type { ReactNode } from "react";
import type { Duty, DutyTypeInfo } from "../types";
import { DutyBlock } from "./DutyBlock";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

interface Group {
  key: string;
  type: string;
  stage: string;
  start: string;
  end: string;
  items: Duty[];
}

interface DayAgendaProps {
  duties: Duty[];
  types: DutyTypeInfo[];
  showStage: boolean; // show the stage next to each time slot
  todayDay?: number | undefined; // the day that opens first and is marked "today"
  detail: (duty: Duty) => ReactNode; // what to show inside each duty card
}

// One day at a time, in time order. Duties that share a type and time sit together.
export default function DayAgenda({ duties, types, showStage, todayDay, detail }: DayAgendaProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const firstWithDuties = days.findIndex((_, i) => duties.some((d) => d.day === i));
  const selected = picked ?? todayDay ?? (firstWithDuties >= 0 ? firstWithDuties : 0);

  const typeOf = (code: string) => types.find((t) => t.code === code);

  const list = duties
    .filter((d) => d.day === selected)
    .sort((a, b) => a.start.localeCompare(b.start) || a.stage.localeCompare(b.stage) || a.place.localeCompare(b.place));

  const groups: Group[] = [];
  list.forEach((d) => {
    const key = `${d.type}|${d.stage}|${d.start}|${d.end}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, type: d.type, stage: d.stage, start: d.start, end: d.end, items: [] };
      groups.push(g);
    }
    g.items.push(d);
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {days.map((name, i) => {
          const count = duties.filter((d) => d.day === i).length;
          const on = i === selected;
          return (
            <button
              key={name}
              onClick={() => setPicked(i)}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "1px solid #d9e0e7",
                background: on ? "#0f4c8a" : "white",
                color: on ? "white" : "#1f2d3d",
                fontWeight: on ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {name}
              {i === todayDay && " (today)"}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 20, color: "#6b7a90", textAlign: "center" }}>
          No duty on {days[selected]}.
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: "4px 16px" }}>
          {groups.map((g, i) => {
            const t = typeOf(g.type);
            const colour = t?.colour ?? "#6b7a90";
            return (
              <div
                key={g.key}
                style={{ display: "flex", gap: 16, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid #eef1f5", flexWrap: "wrap" }}
              >
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700 }}>{g.start} to {g.end}</div>
                  <span
                    style={{ background: colour, color: "white", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                  >
                    {t?.name ?? g.type}
                  </span>
                  {showStage && <div style={{ color: "#6b7a90", fontSize: 12, marginTop: 4 }}>{g.stage}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 220, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.items.map((d) => (
                    <div key={d.id} style={{ minWidth: 190 }}>
                      <DutyBlock colour={colour}>{detail(d)}</DutyBlock>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}