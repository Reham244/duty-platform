import { useEffect, useState } from "react";
import { cancelRequest, getDutyTypes, getMyRequests, requestSubstitution } from "../api";
import type { Duty, DutyTypeInfo, SubstitutionRequest } from "../types";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayIso = () => new Date().toLocaleDateString("en-CA");
const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

interface Props {
  userId: number;
  duties: Duty[];
  onChanged: () => void;
}

// The teacher's own "Request a substitution": choose a date, tick the duties they cannot do.
export default function RequestSubstitution({ userId, duties, onChanged }: Props) {
  const [date, setDate] = useState(todayIso());
  const [picked, setPicked] = useState<number[] | null>(null); // null means all the duties that can still be requested
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<SubstitutionRequest[]>([]);
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    getDutyTypes().then(setTypes);
  }, []);

  useEffect(() => {
    getMyRequests(userId).then(setRequests);
  }, [userId, version]);

  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;
  const day = date ? new Date(date + "T12:00:00").getDay() : -1;
  const dayDuties = duties.filter((d) => d.day === day).sort(byTime);
  const asked = new Set(requests.filter((r) => r.date === date).map((r) => r.dutyId));
  const selectable = dayDuties.filter((d) => !asked.has(d.id));
  const chosen = (picked ?? selectable.map((d) => d.id)).filter((id) => selectable.some((d) => d.id === id));

  function toggle(id: number) {
    setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  }

  async function submit() {
    const error = await requestSubstitution(chosen, date, reason);
    if (error) {
      setMessage({ text: error, ok: false });
      return;
    }
    setMessage({ text: "Substitution requested. Your supervisor has been notified.", ok: true });
    setPicked(null);
    setReason("");
    setVersion((v) => v + 1);
    onChanged();
  }

  async function cancel(r: SubstitutionRequest) {
    if (!window.confirm(`Cancel the request for ${typeName(r.duty.type)} at ${r.duty.place} on ${r.date}?`)) return;
    const error = await cancelRequest(r.id);
    setMessage(error ? { text: error, ok: false } : { text: "Request cancelled.", ok: true });
    setVersion((v) => v + 1);
  }

  return (
    <div style={{ background: "#fffaf2", border: "2px solid #b5651d", borderRadius: 12, padding: 16, margin: "16px 0" }}>
      <b style={{ fontSize: 18, color: "#7a4510" }}>Request a substitution</b>
      <div style={{ color: "#556274", fontSize: 13, margin: "2px 0 10px" }}>
        Choose the day and tick the duties you cannot do. Your supervisor is notified and finds a substitute. Planned:
        a partial leave request in the staff portal will wait until each of your duties has a request or a substitute.
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#556274" }}>
          Date
          <input
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => {
              setDate(e.target.value);
              setPicked(null);
              setMessage(null);
            }}
          />
        </label>
        <span style={{ paddingBottom: 6, fontWeight: 700 }}>{day >= 0 ? dayNames[day] : ""}</span>
      </div>

      <div style={{ margin: "10px 0" }}>
        {dayDuties.length === 0 ? (
          <span style={{ color: "#6b7a90" }}>You have no duty on {day >= 0 ? dayNames[day] : "this day"}.</span>
        ) : (
          dayDuties.map((d) => {
            const already = asked.has(d.id);
            return (
              <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", opacity: already ? 0.6 : 1 }}>
                <input type="checkbox" checked={chosen.includes(d.id)} disabled={already} onChange={() => toggle(d.id)} />
                <span>
                  <b>{typeName(d.type)}</b> at {d.place} ({d.stage}), {d.start} to {d.end}
                  {already && <i style={{ color: "#b5651d" }}> already requested</i>}
                </span>
              </label>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" style={{ minWidth: 260 }} />
        <button
          onClick={submit}
          disabled={chosen.length === 0}
          style={{ background: chosen.length === 0 ? "#c9d2da" : "#b5651d", color: "white", border: 0, borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: chosen.length === 0 ? "default" : "pointer" }}
        >
          Request substitution{chosen.length > 0 ? ` (${chosen.length})` : ""}
        </button>
      </div>
      {message && <p style={{ color: message.ok ? "#1f7a4d" : "#a63a2b", fontWeight: 600, margin: "8px 0 0" }}>{message.text}</p>}

      {requests.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <b>My requests</b>
          {requests.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid #f0e3d0" }}
            >
              <span>
                {r.date}: {typeName(r.duty.type)} at {r.duty.place} ({r.duty.stage}), {r.duty.start} to {r.duty.end}
              </span>
              <span>
                {r.status === "covered" ? (
                  <b style={{ color: "#7a4fb0" }}>Covered{r.substituteName ? ` by ${r.substituteName}` : ""}</b>
                ) : (
                  <>
                    <b style={{ color: "#b5651d" }}>Requested</b>{" "}
                    <button onClick={() => cancel(r)} style={{ fontSize: 12 }}>Cancel</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}