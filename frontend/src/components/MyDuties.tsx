import { useEffect, useState } from "react";
import { dateOfDay, getDutyTypes, getMyDuties, getMySubstituteDuties, hasEmergency, reportEmergency } from "../api";
import type { SubstituteDuty } from "../api";
import type { Duty, DutyTypeInfo, User } from "../types";
import MyAttendance, { AttendanceSummary } from "./MyAttendance";
import { Legend } from "./DutyBlock";
import DayAgenda from "./DayAgenda";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export default function MyDuties({ user }: { user: User }) {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [covers, setCovers] = useState<SubstituteDuty[]>([]);
  const [reported, setReported] = useState(false);
  const [today, setToday] = useState(() => {
    const d = new Date().getDay(); // 0 = Sunday
    return d <= 4 ? d : 3; // on Friday or Saturday, pretend it is Wednesday
  });

  useEffect(() => {
    getMyDuties(user.id).then(setDuties);
    getMySubstituteDuties(user.id).then(setCovers);
  }, [user.id]);

  useEffect(() => {
    getDutyTypes().then(setTypes);
  }, []);

  useEffect(() => {
    hasEmergency(user.id, dateOfDay(today)).then(setReported);
  }, [user.id, today]);

  async function report() {
    await reportEmergency(user.id, dateOfDay(today), "Emergency");
    setReported(true);
  }

  const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);
  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;
  const todays = duties.filter((d) => d.day === today).sort(byTime);

  return (
    <div>
      <h2>My duties</h2>

      <AttendanceSummary user={user} />

      <label>
        Demo only, pretend today is:{" "}
        <select value={today} onChange={(e) => setToday(Number(e.target.value))}>
          {days.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>
      </label>

      {todays.length > 0 && (
        <div style={{ background: "#fbeedc", border: "1px solid #b5651d", padding: 12, borderRadius: 8, margin: "16px 0" }}>
          <b>You have {todays.length} {todays.length === 1 ? "duty" : "duties"} today:</b>{" "}
          {todays.map((d) => `${typeName(d.type)} at ${d.place} (${d.stage}, ${d.start} to ${d.end})`).join("; ")}.
          <br />
          Permission and partial leave are not allowed on a duty day. If you have an emergency,
          press Report an emergency and your supervisor will arrange a substitute.
          <br />
          {reported ? (
            <b style={{ color: "#1f7a4d" }}>Emergency reported. Your supervisor has been notified.</b>
          ) : (
            <button onClick={report}>Report an emergency</button>
          )}
        </div>
      )}

      {covers.length > 0 && (
        <div style={{ background: "#f3ecfa", border: "1px solid #7a4fb0", padding: 12, borderRadius: 8, margin: "16px 0" }}>
          <b>You were asked to substitute:</b>
          {covers.map(({ substitution, duty }) => (
            <div key={substitution.id}>
              {substitution.date}: {typeName(duty.type)} at {duty.place} ({duty.stage}, {duty.start} to {duty.end})
            </div>
          ))}
        </div>
      )}

      <Legend types={types} />

      <DayAgenda
        key={today}
        duties={duties}
        types={types}
        showStage
        todayDay={today}
        detail={(d) => (
          <>
            <b>{d.place}</b>
            <br />
            <small>{d.stage}</small>
          </>
        )}
      />

      <MyAttendance user={user} />
    </div>
  );
}