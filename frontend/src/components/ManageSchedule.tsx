import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { addDuty, deleteDuty, getDutyTypes, getStageDuties, getStages, getUsers } from "../api";
import type { Duty, DutyTypeInfo, StageName, User } from "../types";
import { Legend } from "./DutyBlock";
import DayAgenda from "./DayAgenda";
import DeleteButton from "./DeleteButton";
import TeacherGrid from "./TeacherGrid";
import ConfirmDialog from "./ConfirmDialog";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#556274", fontWeight: 600 };

export default function ManageSchedule({ user }: { user: User }) {
  // Supervisors and admins can see every stage at once. A head of stage is locked to their own.
  const canSeeAll = user.role === "admin" || user.role === "supervisor";
  const today = new Date().getDay(); // 0 = Sunday ... 6 = Saturday

  const [stages, setStages] = useState<StageName[]>([]);
  const [stage, setStage] = useState<StageName | "all">(canSeeAll ? "all" : (user.homeStage ?? "Elementary"));
  const [formStage, setFormStage] = useState<StageName | "">(""); // used when "All stages" is shown
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<"day" | "teacher">("day");
  const [pendingDelete, setPendingDelete] = useState<Duty | null>(null);

  // The add form starts empty, so nothing is added by accident.
  const [typeCode, setTypeCode] = useState("");
  const [place, setPlace] = useState("");
  const [day, setDay] = useState(today);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [teacherId, setTeacherId] = useState(0);

  // Two separate messages: one for the form, one for the schedule below it.
  const [formMessage, setFormMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [listMessage, setListMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getStages().then(setStages);
    getDutyTypes().then(setTypes);
    getUsers().then(setPeople);
  }, []);

  useEffect(() => {
    getStageDuties(stage).then(setDuties);
  }, [stage, version]);

  const targetStage = stage === "all" ? formStage : stage;
  const teachers = people.filter((u) => u.role === "teacher");
  const nameOf = (id: number) => people.find((u) => u.id === id)?.fullName ?? "?";
  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;
  const places = [
    ...new Set([...duties.map((d) => d.place), "Soccer Field", "Basketball Field", "Rainbow Lane", "Cafeteria", "Garage", "Gate 7"]),
  ];

  async function save() {
    if (!targetStage) {
      setFormMessage({ text: "Choose the stage for the new duty.", ok: false });
      return;
    }
    const error = await addDuty({ stage: targetStage, type: typeCode, place, day, start, end, userId: teacherId });
    if (error) {
      setFormMessage({ text: error, ok: false });
      return;
    }
    setFormMessage({ text: `Duty added: ${nameOf(teacherId)}, ${typeName(typeCode)} at ${place.trim()}.`, ok: true });
    // Empty the form again.
    setTypeCode("");
    setPlace("");
    setStart("");
    setEnd("");
    setTeacherId(0);
    setVersion((v) => v + 1);
  }

    function remove(id: number) {
    const d = duties.find((x) => x.id === id);
    if (d) setPendingDelete(d);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const error = await deleteDuty(id);
    setListMessage(error ? { text: error, ok: false } : { text: "Duty deleted.", ok: true });
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

      {/* The add form: green, with its own title and button, so it does not look like a filter. */}
      <div style={{ background: "#f1f9f4", border: "2px solid #1f7a4d", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span
            style={{ background: "#1f7a4d", color: "white", borderRadius: "50%", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}
          >
            +
          </span>
          <b style={{ fontSize: 18, color: "#14532d" }}>Add a new duty</b>
          {targetStage && <span style={{ color: "#556274" }}>to {targetStage}</span>}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {stage === "all" && (
            <label style={field}>
              Stage
              <select value={formStage} onChange={(e) => setFormStage(e.target.value as StageName | "")}>
                <option value="">Choose a stage</option>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label style={field}>
            Duty type
            <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
              <option value="">Choose a duty type</option>
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
            <select value={teacherId || ""} onChange={(e) => setTeacherId(Number(e.target.value))}>
              <option value="">Choose a teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName} ({t.subject})</option>
              ))}
            </select>
          </label>
          <button
            onClick={save}
            style={{ background: "#1f7a4d", color: "white", border: 0, borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          >
            + Add duty
          </button>
        </div>

        {formMessage && (
          <p style={{ color: formMessage.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600, margin: "10px 0 0" }}>{formMessage.text}</p>
        )}
      </div>

      {/* The schedule: the stage filter belongs here, because it only changes what is shown. */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Schedule</h3>
        <label>
          Show stage{" "}
          <select
            value={stage}
            disabled={!canSeeAll}
            onChange={(e) => {
              setStage(e.target.value as StageName | "all");
              setListMessage(null);
            }}
          >
            {canSeeAll && <option value="all">All stages</option>}
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <b>View</b>
        {viewButton("day", "By day")}
        {viewButton("teacher", "By teacher")}
      </div>

      {listMessage && (
        <p style={{ color: listMessage.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600, background: listMessage.ok ? "#f1f9f4" : "#fff5f3", padding: "8px 12px", borderRadius: 8 }}>
          {listMessage.text}
        </p>
      )}

      {duties.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 16, textAlign: "center", color: "#6b7a90" }}>
          No duties scheduled for {stage === "all" ? "any stage" : stage} yet. Use the green form above to add the first one.
        </div>
      ) : (
        <>
          <Legend types={types} />
          {view === "day" ? (
            <DayAgenda
              duties={duties}
              types={types}
              showStage={stage === "all"}
              todayDay={today}
              detail={(d) => (
                <>
                  <b>{nameOf(d.userId)}</b>
                  <br />
                  <small>{d.place}</small>{" "}
                  <DeleteButton onClick={() => remove(d.id)} label="Delete this duty" />
                </>
              )}
            />
          ) : (
            <TeacherGrid duties={duties} types={types} people={people} showStage={stage === "all"} onRemove={remove} />
          )}
        </>
      )}
      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        A teacher cannot have two duties at the same time. A duty that already has attendance or substitution
        history cannot be deleted, so the statistics stay correct.
      </p>
            {pendingDelete && (
        <ConfirmDialog title="Delete this duty?" confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)}>
          <b>{nameOf(pendingDelete.userId)}</b>: {typeName(pendingDelete.type)} at {pendingDelete.place} ({pendingDelete.stage}),{" "}
          {days[pendingDelete.day]} {pendingDelete.start} to {pendingDelete.end}.
          <br />
          This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}