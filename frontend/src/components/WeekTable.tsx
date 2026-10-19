import type { CSSProperties, ReactNode } from "react";
import { columnKeyFor, columnsForStage, genericColumns } from "../bell";
import type { Column } from "../bell";
import type { Duty, DutyTypeInfo, StageName } from "../types";
import { DutyBlock } from "./DutyBlock";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 6, verticalAlign: "top", textAlign: "left", fontSize: 13 };
const stickyLeft: CSSProperties = { position: "sticky", left: 0, zIndex: 1 };

const tint: Record<Column["kind"], string> = {
  session: "#f3f6fa",
  snack: "#e3f0ff",
  break: "#fff1d6",
  dismissal: "#f1e8fb",
};

interface WeekTableProps {
  duties: Duty[];
  types: DutyTypeInfo[];
  stage?: StageName | undefined; // when set, the headers show that stage's times
  highlightDay?: number | undefined;
  detail: (duty: Duty) => ReactNode; // what to show inside each duty block
}

// Days down the left; sessions, snacks, break and dismissal across the top. Each duty sits in its slot.
export default function WeekTable({ duties, types, stage, highlightDay, detail }: WeekTableProps) {
  const typeOf = (code: string) => types.find((t) => t.code === code);
  const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

  const placed = duties.map((d) => ({ duty: d, key: columnKeyFor(d) ?? "other" }));
  const cols: Column[] = [...(stage ? columnsForStage(stage) : genericColumns)];
  if (placed.some((p) => p.key === "other")) cols.push({ key: "other", label: "Other times", kind: "session" });

  const widthOf = (c: Column) => (c.key === "other" ? 170 : c.kind === "session" ? 98 : 150);
  const total = 110 + cols.reduce((sum, c) => sum + widthOf(c), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: total }}>
        <colgroup>
          <col style={{ width: 110 }} />
          {cols.map((c) => (
            <col key={c.key} style={{ width: widthOf(c) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...cell, ...stickyLeft, zIndex: 2 }}>Day</th>
            {cols.map((c) => (
              <th key={c.key} style={cell}>
                <div style={{ background: tint[c.kind], margin: -6, padding: 6 }}>
                  {c.label}
                  {stage && c.start && (
                    <div style={{ fontWeight: 400, fontSize: 11, color: "#556274" }}>
                      {c.start} to {c.end}
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((name, i) => {
            const background = i === highlightDay ? "#eaf3ff" : "white";
            return (
              <tr key={name}>
                <td style={{ ...cell, ...stickyLeft, fontWeight: 700, background }}>{name}</td>
                {cols.map((c) => {
                  const list = placed
                    .filter((p) => p.duty.day === i && p.key === c.key)
                    .map((p) => p.duty)
                    .sort(byTime);
                  return (
                    <td key={c.key} style={{ ...cell, background }}>
                      {list.map((d) => {
                        const t = typeOf(d.type);
                        const colour = t?.colour ?? "#6b7a90";
                        return (
                          <DutyBlock key={d.id} colour={colour}>
                            <b style={{ color: colour }}>{t?.name ?? d.type}</b>
                            <br />
                            {detail(d)}
                          </DutyBlock>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}