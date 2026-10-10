import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getMyAttendance } from "../api";
import type { AttendanceRow } from "../api";
import type { AttendanceStatus, User } from "../types";

const colours: Record<AttendanceStatus, string> = {
  present: "#1f7a4d",
  late: "#b5651d",
  absent: "#a63a2b",
};
const labels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Missed",
};

const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 8, textAlign: "left" };

export default function MyAttendance({ user }: { user: User }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    getMyAttendance(user.id).then(setRows);
  }, [user.id]);

  const count = (s: AttendanceStatus) => rows.filter((r) => r.record.status === s).length;
  const present = count("present");
  const late = count("late");
  const absent = count("absent");
  const total = present + late + absent;
  const rate = total === 0 ? 0 : Math.round((present / total) * 100);

  const box = (label: string, value: string, colour: string) => (
    <div style={{ flex: 1, border: "1px solid #d9e0e7", borderRadius: 10, padding: 12, background: "white" }}>
      <div style={{ color: "#6b7a90", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: colour }}>{value}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 32 }}>
      <h2>My attendance</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {box("On time", String(present), colours.present)}
        {box("Late", String(late), colours.late)}
        {box("Missed", String(absent), colours.absent)}
        {box("Attendance rate", `${rate}%`, "#1b6fd1")}
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
        <thead>
          <tr>
            <th style={cell}>Date</th>
            <th style={cell}>Duty</th>
            <th style={cell}>Place</th>
            <th style={cell}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ record, duty }) => (
            <tr key={record.id}>
              <td style={cell}>{record.date}</td>
              <td style={cell}>{duty.type}</td>
              <td style={cell}>{duty.place} ({duty.stage})</td>
              <td style={{ ...cell, color: colours[record.status], fontWeight: 700 }}>
                {labels[record.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: "#6b7a90", fontSize: 13 }}>
        Only your own records are shown. Duties not marked yet are not counted.
      </p>
    </div>
  );
}