import type { NormalDuties, User } from "../types";

const card = { background: "white", border: "1px solid #d9e0e7", borderRadius: 12, padding: 16 };

// How many weeks the period covers, so the normal number per week can be scaled to it. At least one.
function weeksIn(from: string, to: string): number {
  const ms = new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime();
  return Math.max(1, (Math.round(ms / 86400000) + 1) / 7);
}

const colourOf = (pct: number) => (pct >= 100 ? "#1f7a4d" : pct >= 80 ? "#b5651d" : "#a63a2b");

interface Props {
  teachers: User[];
  normal: NormalDuties;
  done: Record<number, number>; // duties done per person in the period (on time or late)
  from: string;
  to: string;
  limit: number; // 0 means everyone
  search: string;
  onPick: (name: string) => void;
}

// Duties done compared with the normal number of duties for the period, lowest first.
export default function NormalLoadCard({ teachers, normal, done, from, to, limit, search, onPick }: Props) {
  const weeks = weeksIn(from, to);
  const q = search.trim().toLowerCase();

  const rows = teachers
    .filter((t) => q === "" || t.fullName.toLowerCase().includes(q) || (t.subject ?? "").toLowerCase().includes(q))
    .map((t) => {
      const perWeek = normal.perUser[t.id] ?? normal.default;
      const expected = perWeek * weeks;
      const count = done[t.id] ?? 0;
      return { t, perWeek, expected, count, pct: expected === 0 ? 100 : Math.round((count / expected) * 100) };
    })
    .filter((r) => r.perWeek > 0)
    .sort((a, b) => a.pct - b.pct || a.t.fullName.localeCompare(b.t.fullName));

  const shown = q ? rows : rows.slice(0, limit === 0 ? rows.length : limit);

  return (
    <div style={card}>
      <h3 style={{ margin: "0 0 2px", color: "#0f4c8a" }}>Duties done compared with the normal number</h3>
      <div style={{ color: "#6b7a90", fontSize: 12, marginBottom: 10 }}>
        Duties done (on time or late, including substitute duties) divided by the normal number for the period: normal
        per week times {weeks.toFixed(1)} weeks. Lowest first. A teacher with fewer duties than normal shows below 100%
        even if they never missed one. Unmarked duties are not counted.
      </div>
      {shown.length === 0 ? (
        <div style={{ color: "#6b7a90", padding: "8px 0" }}>No teachers to show.</div>
      ) : (
        shown.map((r) => (
          <div key={r.t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #eef1f5" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <button
                onClick={() => onPick(r.t.fullName)}
                title="Show only this teacher"
                style={{ border: 0, background: "none", padding: 0, fontWeight: 700, color: "#0f4c8a", cursor: "pointer", textDecoration: "underline" }}
              >
                {r.t.fullName}
              </button>{" "}
              {r.t.subject && <small style={{ color: "#6b7a90" }}>({r.t.subject})</small>}
            </span>
            <small style={{ color: "#6b7a90", width: 170, textAlign: "right" }}>
              {r.count} done of {r.expected.toFixed(1)} normal
            </small>
            <span style={{ width: 90, height: 8, background: "#e3e8ee", borderRadius: 4, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${Math.min(100, r.pct)}%`, height: "100%", background: colourOf(r.pct) }} />
            </span>
            <b style={{ width: 52, textAlign: "right", color: colourOf(r.pct) }}>{r.pct}%</b>
          </div>
        ))
      )}
      <div style={{ color: "#6b7a90", fontSize: 12, marginTop: 8 }}>
        Colours (proposed): 100% or more green, 80 to 99% amber, below 80% red. Leadership sets the real limits.
      </div>
    </div>
  );
}