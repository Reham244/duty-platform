import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getNormalDuties, getStages, getUsers, setNormalDefault, setUserTarget } from "../api";
import { roleLabels } from "../roles";
import { setUserRole } from "../staffApi";
import type { NormalDuties, Role, StageName, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left", background: "white" };
const roleOrder: Role[] = ["teacher", "supervisor", "head_of_stage", "matron", "hr", "admin"];

export default function StaffRoles() {
  const [people, setPeople] = useState<User[]>([]);
  const [stages, setStages] = useState<StageName[]>([]);
  const [normal, setNormal] = useState<NormalDuties>({ default: 5, perUser: {} });
  const [defaultInput, setDefaultInput] = useState("5");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getStages().then(setStages);
  }, []);

  useEffect(() => {
    getUsers().then(setPeople);
    getNormalDuties().then((n) => {
      setNormal(n);
      setDefaultInput(String(n.default));
    });
  }, [version]);

  const q = search.trim().toLowerCase();
  const shown = people.filter(
    (p) =>
      q === "" ||
      p.fullName.toLowerCase().includes(q) ||
      (p.subject ?? "").toLowerCase().includes(q) ||
      roleLabels[p.role].toLowerCase().includes(q),
  );
  const count = (r: Role) => people.filter((p) => p.role === r).length;

  async function saveRole(p: User, role: Role, stage: StageName | undefined) {
    const error = await setUserRole(p.id, role, stage);
    setMessage(error ? { text: error, ok: false } : { text: `${p.fullName} is now ${roleLabels[role]}.`, ok: true });
    setVersion((v) => v + 1);
  }

  async function saveDefault() {
    const error = await setNormalDefault(Number(defaultInput));
    setMessage(error ? { text: error, ok: false } : { text: `The normal number of duties per week is now ${defaultInput}.`, ok: true });
    setVersion((v) => v + 1);
  }

  // Empty means "use the school default".
  async function saveTarget(p: User, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value === (normal.perUser[p.id] ?? null)) return;
    const error = await setUserTarget(p.id, value);
    setMessage(
      error
        ? { text: error, ok: false }
        : { text: `${p.fullName}: normal duties per week ${value === null ? "back to the school default" : `set to ${value}`}.`, ok: true },
    );
    setVersion((v) => v + 1);
  }

  return (
    <div>
      <h2>Staff and roles</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {roleOrder.map((r) => (
          <div key={r} style={{ border: "1px solid #d9e0e7", borderRadius: 10, padding: "8px 14px", background: "white" }}>
            <div style={{ color: "#6b7a90", fontSize: 12 }}>{roleLabels[r]}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f4c8a" }}>{count(r)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#f3f8ff", border: "1px solid #c8dcf5", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
        <b>Normal number of duties per week</b>
        <div style={{ color: "#556274", fontSize: 13, margin: "2px 0 8px" }}>
          The school default. The statistics compare each teacher's duties with it. Give a teacher a different number in
          the table below if their load is normally higher or lower.
        </div>
        <input type="number" min={0} max={50} step={0.5} value={defaultInput} onChange={(e) => setDefaultInput(e.target.value)} style={{ width: 90 }} />{" "}
        <button onClick={saveDefault} style={{ fontWeight: 700 }}>Save default</button>
      </div>

      <label>
        Find a person{" "}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, subject or role" />
      </label>
      {message && <p style={{ color: message.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600 }}>{message.text}</p>}

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th style={cell}>Person</th>
            <th style={cell}>Subject</th>
            <th style={cell}>Role</th>
            <th style={cell}>Stage</th>
            <th style={cell}>Normal duties per week</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id}>
              <td style={cell}><b>{p.fullName}</b></td>
              <td style={cell}>{p.subject ?? "-"}</td>
              <td style={cell}>
                <select
                  value={p.role}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    saveRole(p, role, role === "head_of_stage" ? (p.homeStage ?? "Elementary") : p.homeStage);
                  }}
                >
                  {roleOrder.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </td>
              <td style={cell}>
                {p.role === "head_of_stage" ? (
                  <select value={p.homeStage} onChange={(e) => saveRole(p, "head_of_stage", e.target.value as StageName)}>
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  (p.homeStage ?? "-")
                )}
              </td>
              <td style={cell}>
                {p.role === "teacher" ? (
                  <input
                    key={`${p.id}-${version}`}
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    defaultValue={normal.perUser[p.id] ?? ""}
                    placeholder={`${normal.default} (default)`}
                    style={{ width: 120 }}
                    onBlur={(e) => saveTarget(p, e.target.value)}
                  />
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p style={{ color: "#6b7a90" }}>Nobody matches this search.</p>}

      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        In the real system the names come from the portal or HR. The admin assigns roles and the normal number of duties.
        A head of stage needs a stage. Leave the number empty to use the school default.
      </p>
    </div>
  );
}