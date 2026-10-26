import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  addSubstitution, getAvailableSubstitutes, getDutyTypes, getNeedsSubstitute,
  getSubstitutionsOn, getUsers, reportEmergency,
} from "../api";
import type { Candidate, NeedRow, SubRow } from "../api";
import type { DutyTypeInfo, StageName, User } from "../types";

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left" };
const card: CSSProperties = { background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 16, marginBottom: 16 };

export default function Substitutions({ user }: { user: User }) {
  // A head of stage only sees their own stage.
  const stage: StageName | "all" = user.role === "head_of_stage" ? (user.homeStage ?? "all") : "all";

  const [date, setDate] = useState("2026-10-07");
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teacherId, setTeacherId] = useState<number>(0);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [picked, setPicked] = useState<NeedRow | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;

  async function refresh() {
    setNeeds(await getNeedsSubstitute(date, stage));
    setSubs(await getSubstitutionsOn(date, stage));
  }

  useEffect(() => {
    getDutyTypes().then(setTypes);
    getUsers().then((list) => {
      const t = list.filter((u) => u.role === "teacher");
      setTeachers(t);
      setTeacherId(t[0]?.id ?? 0);
    });
  }, []);

  useEffect(() => {
    getNeedsSubstitute(date, stage).then(setNeeds);
    getSubstitutionsOn(date, stage).then(setSubs);
  }, [date, stage]);

  useEffect(() => {
    if (picked) getAvailableSubstitutes(picked.duty, date).then(setCandidates);
  }, [picked, date]);

  async function report() {
    await reportEmergency(teacherId, date, "Requested by the supervisor");
    await refresh();
  }

  async function choose(c: Candidate) {
    if (!picked) return;
    await addSubstitution(picked.duty.id, date, c.person.id, picked.report.message);
    setPicked(null);
    await refresh();
  }

  return (
    <div>
      <h2>Substitutions</h2>
      <label>
        Date{" "}
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPicked(null);
          }}
        />
      </label>

      <div style={{ ...card, marginTop: 16 }}>
        <b>Request a substitution for a teacher</b> <small>(for example, when they phone in)</small>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <select value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName} ({t.subject})</option>
            ))}
          </select>
          <button onClick={report}>Create request</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Duties that need a substitute</h3>
        {needs.length === 0 && <p style={{ color: "#6b7a90" }}>No open substitution requests for this date.</p>}
        {needs.map((n) => (
          <div
            key={n.duty.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
              padding: "10px 0", borderBottom: "1px solid #e3e8ee",
              background: picked?.duty.id === n.duty.id ? "#f3ecfa" : undefined,
            }}
          >
            <div>
              <b>{n.person.fullName}</b> ({n.person.subject}), substitution requested
              <br />
              <small>
                {typeName(n.duty.type)} at {n.duty.place}, {n.duty.stage}, {n.duty.start} to {n.duty.end}
              </small>
            </div>
            <button onClick={() => setPicked(n)}>Choose substitute</button>
          </div>
        ))}
      </div>

      {picked && (
        <div style={{ ...card, border: "2px solid #7a4fb0" }}>
          <h3 style={{ marginTop: 0 }}>
            Available teachers (no duty at {picked.duty.start} to {picked.duty.end})
          </h3>
          {candidates.length === 0 ? (
            <p style={{ color: "#a63a2b" }}>Nobody is free at that time.</p>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={cell}>Teacher</th>
                  <th style={cell}>Substitutions so far</th>
                  <th style={cell}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.person.id}>
                    <td style={cell}><b>{c.person.fullName}</b> ({c.person.subject})</td>
                    <td style={cell}>{c.count}</td>
                    <td style={cell}><button onClick={() => choose(c)}>Select</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ color: "#6b7a90", fontSize: 13 }}>
            The original duty will be marked Substituted (excused, not counted as missed). The substitute
            sees the duty in My duties and is marked on the attendance card.
          </p>
        </div>
      )}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Substitutions on this date</h3>
        {subs.length === 0 ? (
          <p style={{ color: "#6b7a90" }}>None yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={cell}>Duty</th>
                <th style={cell}>Absent teacher</th>
                <th style={cell}>Substitute</th>
                <th style={cell}>Substitute attendance</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((r) => (
                <tr key={r.substitution.id}>
                  <td style={cell}>
                    {typeName(r.duty.type)}, {r.duty.place} ({r.duty.stage}, {r.duty.start} to {r.duty.end})
                  </td>
                  <td style={cell}>{r.original.fullName}</td>
                  <td style={cell}><b>{r.substitute.fullName}</b></td>
                  <td style={cell}>{r.substitution.status === "unmarked" ? "Not marked yet" : r.substitution.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}