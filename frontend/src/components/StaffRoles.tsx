import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getStages, getUsers } from "../api";
import { roleLabels } from "../roles";
import { setUserRole } from "../staffApi";
import type { Role, StageName, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left", background: "white" };
const roleOrder: Role[] = ["teacher", "supervisor", "head_of_stage", "matron", "hr", "admin"];

export default function StaffRoles({ user }: { user: User }) {
  const [people, setPeople] = useState<User[]>([]);
  const [stages, setStages] = useState<StageName[]>([]);
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getStages().then(setStages);
  }, []);

  useEffect(() => {
    getUsers().then(setPeople);
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

  async function save(p: User, role: Role, stage: StageName | undefined) {
    const error = await setUserRole(p.id, role, stage, user.id);
    setMessage(
      error ? { text: error, ok: false } : { text: `${p.fullName} is now ${roleLabels[role]}.`, ok: true },
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

      <label>
        Find a person{" "}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, subject or role" />
      </label>
      {message && (
        <p style={{ color: message.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600 }}>{message.text}</p>
      )}

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th style={cell}>Person</th>
            <th style={cell}>Subject</th>
            <th style={cell}>Role</th>
            <th style={cell}>Stage</th>
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
                    save(p, role, role === "head_of_stage" ? (p.homeStage ?? "Elementary") : p.homeStage);
                  }}
                >
                  {roleOrder.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </td>
              <td style={cell}>
                {p.role === "head_of_stage" ? (
                  <select value={p.homeStage} onChange={(e) => save(p, "head_of_stage", e.target.value as StageName)}>
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  (p.homeStage ?? "-")
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p style={{ color: "#6b7a90" }}>Nobody matches this search.</p>}

      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        In the real system the names come from the portal or HR. The admin only assigns roles.
        A head of stage needs a stage. The role changes are kept in memory for now.
      </p>
    </div>
  );
}