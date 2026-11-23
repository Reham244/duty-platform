import { useState } from "react";
import type { CSSProperties } from "react";
import type { StatsRow } from "../api";
import type { Section } from "../statsConfig";
import type { DutyTypeInfo, StageName, StatRecord } from "../types";

const card: CSSProperties = { background: "white", border: "1px solid #d9e0e7", borderRadius: 12, padding: 16 };
const cell: CSSProperties = { border: "1px solid #d9e0e7", padding: 6, textAlign: "left", verticalAlign: "top", fontSize: 13 };

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu"];
const dayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const statusColour: Record<StatRecord["status"], string> = {
  present: "#1f7a4d",
  late: "#b5651d",
  absent: "#a63a2b",
  unmarked: "#6b7a90",
};

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekStart = (iso: string) => addDays(iso, -new Date(iso + "T12:00:00").getDay());
const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

interface Bar {
  label: string;
  value: number;
  colour?: string | undefined;
  note?: string;
}

function BarChart({ title, bars, format, colour, max }: { title: string; bars: Bar[]; format: (n: number) => string; colour: string; max?: number }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {bars.length === 0 ? (
        <div style={{ color: "#6b7a90" }}>Nothing to show.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 175 }}>
          {bars.map((b) => (
            <div
              key={b.label}
              title={b.note ?? b.label}
              style={{ flex: 1, minWidth: 26, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{format(b.value)}</div>
              <div
                style={{ width: "70%", maxWidth: 46, height: `${Math.max(2, (b.value / top) * 120)}px`, background: b.colour ?? colour, borderRadius: "4px 4px 0 0" }}
              />
              <div style={{ fontSize: 11, color: "#6b7a90", marginTop: 4, textAlign: "center", lineHeight: 1.2 }}>{b.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HBars({ title, bars, format, colour }: { title: string; bars: Bar[]; format: (n: number) => string; colour: string }) {
  const top = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {bars.length === 0 ? (
        <div style={{ color: "#6b7a90" }}>Nothing to show.</div>
      ) : (
        bars.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.label}>{b.label}</span>
            <span style={{ flex: 1, height: 10, background: "#e3e8ee", borderRadius: 5, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${(b.value / top) * 100}%`, height: "100%", background: colour }} />
            </span>
            <b style={{ width: 64, textAlign: "right" }}>{format(b.value)}</b>
          </div>
        ))
      )}
    </div>
  );
}

interface StatsDetailProps {
  section: Section;
  records: StatRecord[];
  rows: StatsRow[]; // everyone's totals, used for "share of their duties"
  types: DutyTypeInfo[];
  stage: StageName | "all";
  from: string;
  to: string;
  search: string;
  onBack: () => void;
}

export default function StatsDetail({ section: s, records, rows, types, stage, from, to, search, onBack }: StatsDetailProps) {
  const [showAll, setShowAll] = useState(false);
  const q = search.trim().toLowerCase();

  // Whose number a record counts for: the person who did it, or the teacher who was excused.
  const whoOf = (r: StatRecord) =>
    s.who === "excused"
      ? { id: r.excusedId ?? 0, name: r.excusedName ?? "?", subject: r.excusedSubject }
      : { id: r.personId, name: r.personName, subject: r.subject };

  const events = records
    .filter(s.events)
    .filter((r) => {
      if (!q) return true;
      const w = whoOf(r);
      return w.name.toLowerCase().includes(q) || (w.subject ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));

  // The number for any group of records: a count, hours, or an attendance rate.
  const valueOf = (list: StatRecord[]): number => {
    if (s.measure === "hours") return list.reduce((sum, r) => sum + r.hours, 0);
    if (s.measure === "rate") return list.length === 0 ? 0 : Math.round((list.filter((r) => r.status === "present").length / list.length) * 100);
    return list.length;
  };
  const total = valueOf(events);
  const isRate = s.measure === "rate";

  // One line per person.
  const groups = new Map<number, { id: number; name: string; subject: string | null; list: StatRecord[] }>();
  events.forEach((r) => {
    const w = whoOf(r);
    const g = groups.get(w.id) ?? { id: w.id, name: w.name, subject: w.subject, list: [] };
    g.list.push(r);
    groups.set(w.id, g);
  });
  const dir = s.best === "high" ? -1 : 1;
  const people = [...groups.values()]
    .map((g) => ({
      ...g,
      value: valueOf(g.list),
      present: g.list.filter((r) => r.status === "present").length,
      late: g.list.filter((r) => r.status === "late").length,
      absent: g.list.filter((r) => r.status === "absent").length,
    }))
    .sort((a, b) => dir * (a.value - b.value) || a.name.localeCompare(b.name));
  const ranked = isRate ? people.filter((p) => p.list.length >= 3) : people;

  // Equal values share a rank.
  const rankOf = (index: number) => {
    const value = people[index]?.value;
    const first = people.findIndex((p) => p.value === value);
    return first + 1;
  };

  // Charts.
  const byDay: Bar[] = dayShort.map((label, d) => ({ label, value: valueOf(events.filter((r) => r.day === d)) }));

  const weeks: string[] = [];
  for (let w = weekStart(from); w <= weekStart(to) && weeks.length < 60; w = addDays(w, 7)) weeks.push(w);
  const byWeek: Bar[] = weeks.slice(-26).map((w) => ({
    label: shortDate(w),
    note: `Week of ${w}`,
    value: valueOf(events.filter((r) => weekStart(r.date) === w)),
  }));

  const byStage: Bar[] =
    stage === "all"
      ? [...new Set(events.map((r) => r.stage))].sort().map((st) => ({ label: st, value: valueOf(events.filter((r) => r.stage === st)) }))
      : [];

  const byType: Bar[] = [...new Set(events.map((r) => r.type))].map((code) => {
    const t = types.find((x) => x.code === code);
    return { label: t?.name ?? code, value: valueOf(events.filter((r) => r.type === code)), colour: t?.colour };
  });

  const topPeople: Bar[] = ranked.slice(0, 10).map((p) => ({ label: p.name, value: p.value }));

  const buckets: Bar[] = isRate
    ? [
        { label: "Under 50%", test: (v: number) => v < 50 },
        { label: "50 to 69%", test: (v: number) => v >= 50 && v < 70 },
        { label: "70 to 84%", test: (v: number) => v >= 70 && v < 85 },
        { label: "85 to 99%", test: (v: number) => v >= 85 && v < 100 },
        { label: "100%", test: (v: number) => v === 100 },
      ].map((b) => ({ label: b.label, value: ranked.filter((p) => b.test(p.value)).length }))
    : [];

  // Key numbers.
  const peak = byDay.reduce<Bar | undefined>((best, b) => (best === undefined || b.value > best.value ? b : best), undefined);
  const lowest = isRate ? [...ranked].sort((a, b) => a.value - b.value)[0] : undefined;
  const highest = isRate ? [...ranked].sort((a, b) => b.value - a.value)[0] : undefined;

  const box = (label: string, value: string, sub?: string) => (
    <div style={{ flex: 1, minWidth: 150, border: "1px solid #d9e0e7", borderRadius: 10, padding: 12, background: "white" }}>
      <div style={{ color: "#6b7a90", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: s.colour }}>{value}</div>
      {sub && <div style={{ color: "#6b7a90", fontSize: 12 }}>{sub}</div>}
    </div>
  );

  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;
  const note = (r: StatRecord) =>
    r.kind === "substitute"
      ? s.who === "excused"
        ? `Covered by ${r.personName}`
        : `Covering for ${r.excusedName ?? "?"}`
      : r.byName
        ? `Marked by ${r.byName}`
        : "";

  const shown = showAll ? events : events.slice(0, 100);

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Date", "Day", "Person", "Subject", "Duty", "Place", "Stage", "Time", "Status", "Note"];
    const lines = events.map((r) => {
      const w = whoOf(r);
      return [r.date, dayLong[r.day] ?? "", w.name, w.subject ?? "", typeName(r.type), r.place, r.stage, `${r.start} to ${r.end}`, r.status, note(r)]
        .map(esc)
        .join(",");
    });
    const url = URL.createObjectURL(new Blob(["\ufeff" + [header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${s.key}-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <button onClick={onBack}>← Back to statistics</button>
        <button onClick={exportCsv} disabled={events.length === 0}>Export these records (CSV)</button>
      </div>
      <h3 style={{ margin: "8px 0 2px", color: s.colour, fontSize: 22 }}>{s.title}</h3>
      <div style={{ color: "#6b7a90", marginBottom: 14 }}>
        {s.note} {stage === "all" ? "All stages" : stage}, {from} to {to}.
        {q && <b> Showing only people matching "{search}".</b>}
      </div>

      {events.length === 0 ? (
        <div style={{ ...card, color: "#6b7a90", textAlign: "center" }}>No records for this measure in this period.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {isRate ? (
              <>
                {box("Overall attendance rate", s.format(total), `${events.length} marked duties`)}
                {box("People ranked", String(ranked.length), "at least 3 marked duties")}
                {box("Lowest", lowest ? s.format(lowest.value) : "-", lowest?.name)}
                {box("Highest", highest ? s.format(highest.value) : "-", highest?.name)}
              </>
            ) : (
              <>
                {box("Total", s.format(total), `${events.length} ${events.length === 1 ? "record" : "records"}`)}
                {box("People", String(people.length))}
                {box("Average per person", s.format(people.length === 0 ? 0 : total / people.length))}
                {box("Peak weekday", peak && peak.value > 0 ? peak.label : "-", peak && peak.value > 0 ? s.format(peak.value) : undefined)}
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
            <BarChart title="By weekday" bars={byDay} format={s.format} colour={s.colour} {...(isRate ? { max: 100 } : {})} />
            <BarChart title="By week" bars={byWeek} format={s.format} colour={s.colour} {...(isRate ? { max: 100 } : {})} />
            {byStage.length > 1 && <BarChart title="By stage" bars={byStage} format={s.format} colour={s.colour} {...(isRate ? { max: 100 } : {})} />}
            <BarChart title="By duty type" bars={byType} format={s.format} colour={s.colour} {...(isRate ? { max: 100 } : {})} />
            {isRate && <BarChart title="People by attendance rate" bars={buckets} format={(n) => String(n)} colour={s.colour} />}
            <HBars title={isRate ? "People (top 10 of this ranking)" : "Top 10 people"} bars={topPeople} format={s.format} colour={s.colour} />
          </div>

          <h3 style={{ marginBottom: 6 }}>Everyone ({people.length})</h3>
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
              <thead>
                <tr>
                  <th style={{ ...cell, width: 40 }}>#</th>
                  <th style={cell}>Person</th>
                  {isRate ? (
                    <>
                      <th style={cell}>Present</th>
                      <th style={cell}>Late</th>
                      <th style={cell}>Missed</th>
                      <th style={cell}>Marked</th>
                      <th style={cell}>Rate</th>
                    </>
                  ) : (
                    <>
                      <th style={cell}>{s.title}</th>
                      <th style={cell}>Share of the total</th>
                      {s.ofDuties && <th style={cell}>Share of their marked duties</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => {
                  const theirs = rows.find((r) => r.person.id === p.id);
                  return (
                    <tr key={p.id}>
                      <td style={cell}>{rankOf(i)}</td>
                      <td style={cell}>
                        <b>{p.name}</b> {p.subject && <small style={{ color: "#6b7a90" }}>({p.subject})</small>}
                      </td>
                      {isRate ? (
                        <>
                          <td style={cell}>{p.present}</td>
                          <td style={cell}>{p.late}</td>
                          <td style={cell}>{p.absent}</td>
                          <td style={cell}>
                            {p.list.length}
                            {p.list.length < 3 && <small style={{ color: "#6b7a90" }}> (few duties)</small>}
                          </td>
                          <td style={{ ...cell, fontWeight: 700 }}>{s.format(p.value)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...cell, fontWeight: 700 }}>{s.format(p.value)}</td>
                          <td style={cell}>{total === 0 ? "-" : `${Math.round((p.value / total) * 100)}%`}</td>
                          {s.ofDuties && (
                            <td style={cell}>{theirs && theirs.marked > 0 ? `${Math.round((p.list.length / theirs.marked) * 100)}%` : "-"}</td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginBottom: 6 }}>Every record ({events.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
              <thead>
                <tr>
                  <th style={cell}>Date</th>
                  <th style={cell}>Person</th>
                  <th style={cell}>Duty</th>
                  <th style={cell}>Stage</th>
                  <th style={cell}>Time</th>
                  <th style={cell}>Status</th>
                  <th style={cell}>Note</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const w = whoOf(r);
                  return (
                    <tr key={r.id}>
                      <td style={cell}>
                        {r.date}
                        <div style={{ color: "#6b7a90", fontSize: 12 }}>{dayLong[r.day]}</div>
                      </td>
                      <td style={cell}><b>{w.name}</b></td>
                      <td style={cell}>
                        {typeName(r.type)}
                        <div style={{ color: "#6b7a90", fontSize: 12 }}>{r.place}</div>
                      </td>
                      <td style={cell}>{r.stage}</td>
                      <td style={cell}>{r.start} to {r.end}</td>
                      <td style={{ ...cell, color: statusColour[r.status], fontWeight: 700 }}>{r.status}</td>
                      <td style={cell}>{note(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {events.length > 100 && (
            <p>
              <button onClick={() => setShowAll(!showAll)}>{showAll ? "Show the latest 100" : `Show all ${events.length}`}</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}