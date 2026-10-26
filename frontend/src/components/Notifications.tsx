import { useEffect, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead, runReminderCheck } from "../api";
import type { AppNotification, User } from "../types";

const colourOf: Record<string, string> = {
  "duty-reminder": "#1b6fd1",
  substitution: "#7a4fb0",
  excused: "#b5651d",
  "substitution-request": "#a63a2b",
};
const labelOf: Record<string, string> = {
  "duty-reminder": "Reminder",
  substitution: "Substitute",
  excused: "Excused",
  "substitution-request": "Request",
};

export default function Notifications({ user, onChanged }: { user: User; onChanged: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [version, setVersion] = useState(0);
  const [date, setDate] = useState("2026-10-07");
  const [time, setTime] = useState("12:25");
  const [again, setAgain] = useState(true);
  const [result, setResult] = useState("");

  useEffect(() => {
    getNotifications().then(setItems);
  }, [version]);

  async function open(n: AppNotification) {
    if (n.read) return;
    await markNotificationRead(n.id);
    setVersion((v) => v + 1);
    onChanged();
  }

  async function readAll() {
    await markAllNotificationsRead();
    setVersion((v) => v + 1);
    onChanged();
  }

  async function runCheck() {
    const sent = await runReminderCheck(date, time, again);
    setResult(
      sent > 0
        ? `${sent} reminder${sent === 1 ? "" : "s"} sent.`
        : "No reminders sent. Nobody has a duty starting in the next 10 minutes on that date, or they were already reminded (tick the box to send again).",
    );
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <h2>Notifications</h2>

      {user.role === "admin" && (
        <div style={{ background: "#eef5ff", border: "1px solid #c8dcf5", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <b>Reminders (demo tool)</b>
          <div style={{ color: "#6b7a90", fontSize: 13, margin: "2px 0 8px" }}>
            Reminders go out automatically 10 minutes before each duty. To try it now, choose a school day and a time
            shortly before a duty starts, for example 12:25 on 2026-10-07 for the Elementary break at 12:35.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label>
              Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Time <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label>
              <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Send again
            </label>
            <button onClick={runCheck} style={{ fontWeight: 700 }}>Run reminder check</button>
          </div>
          {result && <p style={{ margin: "8px 0 0", fontWeight: 600 }}>{result}</p>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "#6b7a90" }}>{unread === 0 ? "You are up to date." : `${unread} unread`}</span>
        <button onClick={readAll} disabled={unread === 0}>Mark all as read</button>
      </div>

      {items.length === 0 && (
        <div style={{ background: "white", border: "1px solid #d9e0e7", borderRadius: 10, padding: 24, color: "#6b7a90", textAlign: "center" }}>
          No notifications yet.
        </div>
      )}

      {items.map((n) => (
        <div
          key={n.id}
          onClick={() => open(n)}
          style={{
            background: n.read ? "white" : "#f3f8ff",
            border: "1px solid #d9e0e7",
            borderLeft: `5px solid ${colourOf[n.kind] ?? "#6b7a90"}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 10,
            cursor: n.read ? "default" : "pointer",
          }}
        >
          <div style={{ fontWeight: n.read ? 400 : 700 }}>
            <span
              style={{
                background: colourOf[n.kind] ?? "#6b7a90",
                color: "white",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                marginRight: 8,
              }}
            >
              {labelOf[n.kind] ?? n.kind}
            </span>
            {n.title}
          </div>
          <div style={{ margin: "4px 0" }}>{n.body}</div>
          <small style={{ color: "#6b7a90" }}>
            {n.createdAt.slice(0, 16)}
            {n.fromName && ` from ${n.fromName}`}
          </small>
        </div>
      ))}
    </div>
  );
}