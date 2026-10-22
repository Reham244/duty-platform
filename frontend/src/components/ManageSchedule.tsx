import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { addDuty, deleteDuty, getDutyTypes, getStageDuties, getStages, getUsers } from "../api";
import type { Duty, DutyTypeInfo, StageName, User } from "../types";
import { Legend } from "./DutyBlock";
import DayAgenda from "./DayAgenda";
import TeacherGrid from "./TeacherGrid";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e0e7",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
};
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#6b7a90" };

export default function ManageSchedule({ user }: { user: User }) {
  // Supervisors and admins can see every stage at once. A head of stage is locked to their own.
  const canSeeAll = user.role === "admin" || user.role === "supervisor";

  const [stages, setStages] = useState<StageName[]>([]);
  const [stage, setStage] = useState<StageName | "all">(canSeeAll ? "all" : (user.homeStage ?? "Elementary"));
  const [formStage, setFormStage] = useState<StageName>("Elementary"); // used when "All stages" is shown
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<"day" | "teacher">("day");

  const [typeCode, setTypeCode] = useState("");
  const [place, setPlace] = useState("");
  const [day, setDay] = useState(0);
  const [start, setStart] = useState("12:35");
  const [end, setEnd] = useState("13:05");
  const [teacherId, setTeacherId] = useState(0);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getStages().then(setStages);
    getDutyTypes().then(setTypes);
    getUsers().then(setPeople);
  }, []);

  useEffect(() => {
    getStageDuties(stage).then(setDuties);
  }, [stage, version]);

  const targetStage: StageName = stage === "all" ? formStage : stage;
  const teachers = people.filter((u) => u.role === "teacher");
  const chosenType = typeCode || types[0]?.code || "";
  const chosenTeacher = teacherId || teachers[0]?.id || 0;
  const nameOf = (id: number) => people.find((u) => u.id === id)?.fullName ?? "?";
  const places = [
    ...new Set([...duties.map((d) => d.place), "Soccer Field", "Basketball Field", "Rainbow Lane", "Cafeteria", "Garage", "Gate 7"]),
  ];

  async function save() {
    const error = await addDuty({ stage: targetStage, type: chosenType, place, day, start, end, userId: chosenTeacher });
    if (error) {
      setMessage({ text: error, ok: false });
      return;
    }
    setMessage({ text: "Duty added.", ok: true });
    setPlace("");
    setVersion((v) => v + 1);
  }

  async function remove(id: number) {
    const error = await deleteDuty(id);
    setMessage(error ? { text: error, ok: false } : { text: "Duty removed.", ok: true });
    setVersion((v) => v + 1);
  }

  const viewButton = (id: "day" | "teacher", label: string) => (
    <button
      onClick={() => setView(id)}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        border: "1px solid #d9e0e7",
        background: view === id ? "#0f4c8a" : "white",
        color: view === id ? "white" : "#1f2d3d",
        fontWeight: view === id ? 700 : 400,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h2>Manage schedule</h2>

      <label>
        Stage{" "}
        <select
          value={stage}
          disabled={!canSeeAll}
          onChange={(e) => {
            setStage(e.target.value as StageName | "all");
            setMessage(null);
          }}
        >
          {canSeeAll && <option value="all">All stages</option>}
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <div style={{ ...card, marginTop: 16 }}>
        <b>Add a duty to {targetStage}</b>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, alignItems: "flex-end" }}>
          {stage === "all" && (
            <label style={field}>
              Stage
              <select value={formStage} onChange={(e) => setFormStage(e.target.value as StageName)}>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label style={field}>
            Duty type
            <select value={chosenType} onChange={(e) => setTypeCode(e.target.value)}>
              {types.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </label>
          <label style={field}>
            Place
            <input list="places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Type or choose" />
            <datalist id="places">
              {places.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label style={field}>
            Day
            <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {days.map((n, i) => (
                <option key={n} value={i}>{n}</option>
              ))}
            </select>
          </label>
          <label style={field}>
            From
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label style={field}>
            To
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label style={field}>
            Teacher
            <select value={chosenTeacher} onChange={(e) => setTeacherId(Number(e.target.value))}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName} ({t.subject})</option>
              ))}
            </select>
          </label>
          <button onClick={save} style={{ padding: "8px 16px", fontWeight: 700 }}>Add duty</button>
        </div>
        {message && (
          <p style={{ color: message.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600, marginBottom: 0 }}>{message.text}</p>
        )}
      </div>

      {duties.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7a90" }}>
          No duties scheduled for {stage === "all" ? "any stage" : stage} yet. Use the form above to add the first one.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <b>View</b>
            {viewButton("day", "By day")}
            {viewButton("teacher", "By teacher")}
          </div>
          <Legend types={types} />

          {view === "day" ? (
            <DayAgenda
              duties={duties}
              types={types}
              showStage={stage === "all"}
              detail={(d) => (
                <>
                  <b>{nameOf(d.userId)}</b>
                  <br />
                  <small>{d.place}</small>{" "}
                  <button onClick={() => remove(d.id)} aria-label="Remove duty" title="Remove duty">×</button>
                </>
              )}
            />
          ) : (
            <TeacherGrid duties={duties} types={types} people={people} showStage={stage === "all"} onRemove={remove} />
          )}
        </>
      )}
      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        A teacher cannot have two duties at the same time. A duty with attendance history cannot be deleted.
      </p>
    </div>
  );
}