import { useEffect, useState } from "react";
import { getCards, getDutyTypes, getStages, markAttendance } from "../api";
import type { Card } from "../api";
import type { AttendanceStatus, CardStatus, DutyTypeInfo, StageName, User } from "../types";

const colours: Record<AttendanceStatus, string> = {
  present: "#1f7a4d",
  late: "#b5651d",
  absent: "#a63a2b",
};

const buttons: { status: AttendanceStatus; label: string }[] = [
  { status: "present", label: "Present" },
  { status: "late", label: "Late" },
  { status: "absent", label: "Absent" },
];

export default function AttendanceCards({ user }: { user: User }) {
  const [stages, setStages] = useState<StageName[]>([]);
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  // A head of stage starts on their own stage; others start on Elementary.
  const [stage, setStage] = useState<StageName>(user.homeStage ?? "Elementary");
  const [date, setDate] = useState("2026-10-07"); // a Wednesday, for the demo
  const [cards, setCards] = useState<Card[]>([]);

  const day = date ? new Date(date + "T12:00:00").getDay() : -1;

  useEffect(() => {
    getStages().then(setStages);
    getDutyTypes().then(setTypes);
  }, []);

  useEffect(() => {
    getCards(stage, day, date).then(setCards);
  }, [stage, day, date]);

  async function mark(dutyId: number, status: AttendanceStatus) {
    await markAttendance(dutyId, date, status);
    setCards(await getCards(stage, day, date));
  }

  const count = (s: CardStatus) => cards.filter((c) => c.status === s).length;
  const typeInfo = (code: string) => types.find((t) => t.code === code);

  return (
    <div>
      <h2>Attendance cards</h2>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Stage{" "}
          <select
            value={stage}
            disabled={user.role === "head_of_stage"}
            onChange={(e) => setStage(e.target.value as StageName)}
          >
            {stages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Date{" "}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 20, fontWeight: 700, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: colours.present }}>Present {count("present")}</span>
        <span style={{ color: colours.late }}>Late {count("late")}</span>
        <span style={{ color: colours.absent }}>Absent {count("absent")}</span>
        <span style={{ color: "#6b7a90" }}>Unmarked {count("unmarked")}</span>
      </div>

      {cards.length === 0 && (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          No duties scheduled for {stage} on this day. A supervisor can add duties in Manage schedule.
        </div>
      )}

      {cards.map(({ duty, person, status }) => {
        const info = typeInfo(duty.type);
        return (
          <div
            key={duty.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              background: "white",
              border: "1px solid #d9e0e7",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {person.fullName} ({person.subject})
              </div>
              <div style={{ color: "#6b7a90", fontSize: 14 }}>
                <span style={{ background: info?.colour ?? "#6b7a90", color: "white", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, marginRight: 8 }}>
                  {info?.name ?? duty.type}
                </span>
                {duty.place}, {duty.start} to {duty.end}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {buttons.map((b) => (
                <button
                  key={b.status}
                  onClick={() => mark(duty.id, b.status)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${status === b.status ? colours[b.status] : "#d9e0e7"}`,
                    background: status === b.status ? colours[b.status] : "white",
                    color: status === b.status ? "white" : "#1f2d3d",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}