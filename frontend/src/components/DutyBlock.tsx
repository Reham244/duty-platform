import type { ReactNode } from "react";
import type { DutyTypeInfo } from "../types";

// One duty inside a schedule cell, coloured by its duty type.
export function DutyBlock({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: `${colour}22`,
        borderLeft: `5px solid ${colour}`,
        borderRadius: 6,
        padding: "6px 8px",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// A key that shows which colour means which duty type.
export function Legend({ types }: { types: DutyTypeInfo[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "12px 0" }}>
      {types.map((t) => (
        <span key={t.code} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: t.colour, display: "inline-block" }} />
          {t.name}
        </span>
      ))}
    </div>
  );
}