import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { addDutyType, getDutyTypeCounts, getDutyTypes } from "../api";
import type { DutyTypeInfo } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left", background: "white" };

export default function DutyTypes() {
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [version, setVersion] = useState(0);
  const [name, setName] = useState("");
  const [colour, setColour] = useState("#2f8f83");
  const [weight, setWeight] = useState(1);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getDutyTypes().then(setTypes);
    getDutyTypeCounts().then(setCounts);
  }, [version]);

  async function save() {
    const error = await addDutyType(name, colour, weight);
    if (error) {
      setMessage({ text: error, ok: false });
      return;
    }
    setMessage({ text: "Duty type added. It now appears in the schedule and on teachers' screens.", ok: true });
    setName("");
    setVersion((v) => v + 1);
  }

  return (
    <div>
      <h2>Duty types</h2>
      <p style={{ color: "#6b7a90" }}>
        The kinds of duty the school tracks (snack, break, dismissal, after-school programs, and so on).
        The weight is for workload later; it is not used in the numbers yet.
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={cell}>Type</th>
            <th style={cell}>Code</th>
            <th style={cell}>Weight</th>
            <th style={cell}>Duties using it</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.code}>
              <td style={cell}>
                <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: t.colour, marginRight: 8, verticalAlign: "middle" }} />
                <b>{t.name}</b>
              </td>
              <td style={cell}>{t.code}</td>
              <td style={cell}>{t.weight}</td>
              <td style={cell}>{counts[t.code] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 16 }}>
        <b>Add a duty type</b>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#6b7a90" }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="After-school program" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#6b7a90" }}>
            Colour
            <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#6b7a90" }}>
            Weight
            <input type="number" min={0} step={0.5} value={weight} onChange={(e) => setWeight(Number(e.target.value))} style={{ width: 80 }} />
          </label>
          <button onClick={save} style={{ padding: "8px 16px", fontWeight: 700 }}>Add type</button>
        </div>
        {message && (
          <p style={{ color: message.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600, marginBottom: 0 }}>{message.text}</p>
        )}
      </div>
    </div>
  );
}