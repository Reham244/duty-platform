import { useEffect, useState } from "react";
import {
  addSubstitution, getAvailableSubstitutes, getCards, getDutyTypes, getStages, markAttendance,
  markSubstituteAttendance, notifyDuties,
} from "../api";
import type { Candidate, Card } from "../api";
import type { AttendanceStatus, DutyTypeInfo, StageName, User } from "../types";

const colours: Record<AttendanceStatus, string> = {
  present: "#1f7a4d",
  late: "#b5651d",
  absent: "#a63a2b",
};
const purple = "#7a4fb0";

const buttons: { status: AttendanceStatus; label: string }[] = [
  { status: "present", label: "Present" },
  { status: "late", label: "Late" },
  { status: "absent", label: "Absent" },
];

const chip = (text: string, colour: string) => (
  <span style={{ background: colour, color: "white", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, marginRight: 8 }}>
    {text}
  </span>
);

// Whose attendance is taken on a card: the substitute if there is one, otherwise the assigned teacher.
function effectiveStatus(c: Card): string {
  return c.status === "substituted" && c.substitution ? c.substitution.status : c.status;
}

export default function AttendanceCards({ user }: { user: User }) {
  // Supervisors and admins can see every stage at once. A head of stage is locked to their own.
  const canSeeAll = user.role === "admin" || user.role === "supervisor";

  const [stages, setStages] = useState<StageName[]>([]);
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [stage, setStage] = useState<StageName | "all">(canSeeAll ? "all" : (user.homeStage ?? "Elementary"));
  const [date, setDate] = useState("2026-10-07"); // a Wednesday, for the demo
  const [cards, setCards] = useState<Card[]>([]);
  const [panelFor, setPanelFor] = useState<number | null>(null); // the duty whose substitute list is open
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [panelMessage, setPanelMessage] = useState("");
  const [notifyTime, setNotifyTime] = useState("");
  const [notified, setNotified] = useState("");

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

  async function markSubstitute(substitutionId: number, status: AttendanceStatus) {
    await markSubstituteAttendance(substitutionId, status);
    setCards(await getCards(stage, day, date));
  }

  // Opens or closes the list of available teachers under a card.
  async function togglePanel(c: Card) {
    if (panelFor === c.duty.id) {
      setPanelFor(null);
      return;
    }
    setPanelMessage("");
    setCandidates(await getAvailableSubstitutes(c.duty, date));
    setPanelFor(c.duty.id);
  }

  async function choose(c: Card, candidate: Candidate) {
    const error = await addSubstitution(c.duty.id, date, candidate.person.id, "Chosen from the attendance card");
    if (error) {
      setPanelMessage(error);
      return;
    }
    setPanelFor(null);
    setNotified("The substitute and the excused teacher were notified.");
    setCards(await getCards(stage, day, date));
  }

  // Notifications: all teachers on duty, one time slot, or one card.
  const times = [...new Set(cards.map((c) => c.duty.start))].sort();
  const activeTime = times.includes(notifyTime) ? notifyTime : "";
  const targets = cards.filter((c) => !activeTime || c.duty.start === activeTime);

  async function notify(list: Card[]) {
    const sent = await notifyDuties(list.map((c) => c.duty.id), date);
    setNotified(`Notification sent to ${sent} ${sent === 1 ? "teacher" : "teachers"}.`);
  }

  const count = (s: string) => cards.filter((c) => effectiveStatus(c) === s).length;
  const excusedCount = cards.filter((c) => c.status === "substituted").length;
  const typeInfo = (code: string) => types.find((t) => t.code === code);

  const statusButtons = (current: string, onPick: (s: AttendanceStatus) => void) => (
    <>
      {buttons.map((b) => (
        <button
          key={b.status}
          onClick={() => onPick(b.status)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${current === b.status ? colours[b.status] : "#d9e0e7"}`,
            background: current === b.status ? colours[b.status] : "white",
            color: current === b.status ? "white" : "#1f2d3d",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {b.label}
        </button>
      ))}
    </>
  );

  return (
    <div>
      <h2>Attendance cards</h2>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Stage{" "}
          <select
            value={stage}
            disabled={!canSeeAll}
            onChange={(e) => {
              setStage(e.target.value as StageName | "all");
              setPanelFor(null);
              setNotified("");
            }}
          >
            {canSeeAll && <option value="all">All stages</option>}
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPanelFor(null);
              setNotified("");
            }}
          />
        </label>
      </div>

      {cards.length > 0 && (
        <div
          style={{
            display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#eef5ff",
            border: "1px solid #c8dcf5", borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          }}
        >
          <b>Notify teachers on duty</b>
          <select value={activeTime} onChange={(e) => setNotifyTime(e.target.value)}>
            <option value="">All times</option>
            {times.map((t) => (
              <option key={t} value={t}>Duties starting at {t}</option>
            ))}
          </select>
          <button onClick={() => notify(targets)} style={{ fontWeight: 700 }}>
            Notify ({targets.length})
          </button>
          {notified && <span style={{ color: "#1f7a4d", fontWeight: 600 }}>{notified}</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 20, fontWeight: 700, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: colours.present }}>Present {count("present")}</span>
        <span style={{ color: colours.late }}>Late {count("late")}</span>
        <span style={{ color: colours.absent }}>Absent {count("absent")}</span>
        <span style={{ color: "#6b7a90" }}>Unmarked {count("unmarked")}</span>
        <span style={{ color: purple }}>Excused (covered) {excusedCount}</span>
      </div>

      {cards.length === 0 && (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          No duties scheduled for {stage === "all" ? "any stage" : stage} on this day. A supervisor can add duties in Manage schedule.
        </div>
      )}

      {cards.map((c) => {
        const { duty, person, status, emergency, substitution } = c;
        const info = typeInfo(duty.type);
        const sub = status === "substituted" ? substitution : undefined;
        return (
          <div
            key={duty.id}
            style={{
              background: sub ? "#faf7fd" : "white",
              border: `1px solid ${sub ? "#d9c8ee" : "#d9e0e7"}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {person.fullName} ({person.subject}) {sub && chip("Excused", purple)}
                </div>
                <div style={{ color: "#6b7a90", fontSize: 14 }}>
                  {chip(info?.name ?? duty.type, info?.colour ?? "#6b7a90")}
                  {stage === "all" && <b>{duty.stage}: </b>}
                  {duty.place}, {duty.start} to {duty.end}
                  {emergency && <span style={{ marginLeft: 8 }}>{chip("substitution requested", "#b5651d")}</span>}
                </div>
              </div>

              {!sub && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {statusButtons(status, (s) => mark(duty.id, s))}
                  <button
                    onClick={() => togglePanel(c)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${purple}`,
                      background: panelFor === duty.id ? "#f3ecfa" : "white",
                      color: purple,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Substitute
                  </button>
                  <button onClick={() => notify([c])} title="Send a reminder to this teacher">Notify</button>
                </div>
              )}
            </div>

            {sub && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px dashed #d9c8ee",
                }}
              >
                <div>
                  {chip("Substitute", purple)}
                  <b>{sub.person.fullName}</b> ({sub.person.subject})
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {statusButtons(sub.status, (s) => markSubstitute(sub.id, s))}
                  <button onClick={() => notify([c])} title="Send a reminder to the substitute">Notify</button>
                </div>
              </div>
            )}

            {panelFor === duty.id && !sub && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #d9c8ee" }}>
                <b>Available teachers</b>{" "}
                <small style={{ color: "#6b7a90" }}>(no duty at {duty.start} to {duty.end}, fewest substitutions first)</small>
                {candidates.length === 0 && <p style={{ color: "#a63a2b", margin: "8px 0" }}>Nobody is free at that time.</p>}
                {candidates.map((cand) => (
                  <div
                    key={cand.person.id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #eef1f5" }}
                  >
                    <span>
                      <b>{cand.person.fullName}</b> ({cand.person.subject}) <small>substitutions so far: {cand.count}</small>
                    </span>
                    <button onClick={() => choose(c, cand)}>Select</button>
                  </div>
                ))}
                {panelMessage && <p style={{ color: "#a63a2b", fontWeight: 600, margin: "8px 0 0" }}>{panelMessage}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}