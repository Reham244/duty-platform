import { useEffect, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api";
import type { AppNotification } from "../types";

const colourOf: Record<string, string> = {
  "duty-reminder": "#1b6fd1",
  substitution: "#7a4fb0",
  excused: "#b5651d",
};
const labelOf: Record<string, string> = {
  "duty-reminder": "Reminder",
  substitution: "Substitute",
  excused: "Excused",
};

export default function Notifications({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [version, setVersion] = useState(0);

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

  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <h2>Notifications</h2>
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