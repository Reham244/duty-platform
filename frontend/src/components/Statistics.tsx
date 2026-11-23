import NormalLoadCard from "../stats/NormalLoadCard";
import { useEffect, useState } from "react";
import { getDutyTypes, getNormalDuties, getStages, getStatRecords, getStats, getStatsCoverage, getUsers } from "../api";
import type { StatsRow } from "../api";
import { sections } from "../statsConfig";
import type { Section } from "../statsConfig";
import type { Coverage, DutyTypeInfo, NormalDuties, StageName, StatRecord, User } from "../types";
import StatsDetail from "./StatsDetail";

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const card = { background: "white", border: "1px solid #d9e0e7", borderRadius: 12, padding: 16 };

function sortFor(list: StatsRow[], s: Section): StatsRow[] {
  const dir = s.best === "high" ? -1 : 1;
  return [...list].sort((a, b) => dir * (s.value(a) - s.value(b)) || a.person.fullName.localeCompare(b.person.fullName));
}

// Equal values share the same rank.
function ranksOf(sorted: StatsRow[], value: (r: StatsRow) => number): Map<number, number> {
  const out = new Map<number, number>();
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    const rank = prev && value(prev) === value(r) ? (out.get(prev.person.id) ?? i + 1) : i + 1;
    out.set(r.person.id, rank);
  });
  return out;
}

interface SectionCardProps {
  section: Section;
  rows: StatsRow[]; // everyone in the period
  matches: StatsRow[]; // people found by the search
  searching: boolean;
  limit: number; // 0 means all
  onOpen: () => void;
}

function SectionCard({ section: s, rows, matches, searching, limit, onOpen }: SectionCardProps) {
  const sorted = sortFor(rows.filter(s.show), s);
  const ranks = ranksOf(sorted, s.value);
  const scale = s.scaleMax ?? Math.max(1, ...sorted.map(s.value));
  const list = searching ? sortFor(matches, s) : sorted.slice(0, limit === 0 ? sorted.length : limit);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3 style={{ margin: "0 0 2px", color: s.colour }}>{s.title}</h3>
        <button onClick={onOpen} style={{ whiteSpace: "nowrap", fontWeight: 700 }}>Details and chart ›</button>
      </div>
      <div style={{ color: "#6b7a90", fontSize: 12, marginBottom: 10 }}>{s.note}</div>
      {list.length === 0 ? (
        <div style={{ color: "#6b7a90", padding: "8px 0" }}>Nobody in this period.</div>
      ) : (
        list.map((r) => (
          <div key={r.person.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #eef1f5" }}>
            <span style={{ width: 26, color: "#6b7a90", fontWeight: 700 }}>{ranks.get(r.person.id) ?? "-"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{r.person.fullName}</b> {r.person.subject && <small style={{ color: "#6b7a90" }}>({r.person.subject})</small>}
            </span>
            <span style={{ width: 90, height: 8, background: "#e3e8ee", borderRadius: 4, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${Math.min(100, (s.value(r) / scale) * 100)}%`, height: "100%", background: s.colour }} />
            </span>
            <b style={{ width: 64, textAlign: "right" }}>{s.format(s.value(r))}</b>
          </div>
        ))
      )}
      <div style={{ color: "#6b7a90", fontSize: 12, marginTop: 8 }}>
        {searching
          ? `Rank among ${sorted.length} ${sorted.length === 1 ? "person" : "people"} in this section.`
          : `Showing ${list.length} of ${sorted.length}.`}
      </div>
    </div>
  );
}

export default function Statistics({ user }: { user: User }) {
  const locked = user.role === "head_of_stage";
  const [stages, setStages] = useState<StageName[]>([]);
  const [types, setTypes] = useState<DutyTypeInfo[]>([]);
  const [stage, setStage] = useState<StageName | "all">(user.homeStage ?? "all");
  const [from, setFrom] = useState(isoDaysAgo(28));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [coverage, setCoverage] = useState<Coverage>({ expected: 0, recorded: 0 });
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(5);
  const [detail, setDetail] = useState<string | null>(null);
  const [records, setRecords] = useState<StatRecord[]>([]);
  const [normal, setNormal] = useState<NormalDuties>({ default: 5, perUser: {} });
  const [staff, setStaff] = useState<User[]>([]);
  const detailOpen = detail !== null;

  useEffect(() => {
    getStages().then(setStages);
    getDutyTypes().then(setTypes);
    getNormalDuties().then(setNormal);
    getUsers().then(setStaff);  }, []);

  useEffect(() => {
    getStats(stage, from, to).then(setRows);
    getStatsCoverage(stage, from, to).then(setCoverage);
  }, [stage, from, to]);

  // The individual records are only loaded when a detail page is open.
  useEffect(() => {
    if (detailOpen) getStatRecords(stage, from, to).then(setRecords);
  }, [detailOpen, stage, from, to]);

  const q = search.trim().toLowerCase();
  const searching = q !== "";
  const matches = rows.filter(
    (r) => r.person.fullName.toLowerCase().includes(q) || (r.person.subject ?? "").toLowerCase().includes(q),
  );

  const total = rows.reduce(
    (t, r) => ({
      present: t.present + r.present,
      late: t.late + r.late,
      absent: t.absent + r.absent,
      marked: t.marked + r.marked,
      hours: t.hours + r.hours,
      covered: t.covered + r.covered,
      excused: t.excused + r.excused,
    }),
    { present: 0, late: 0, absent: 0, marked: 0, hours: 0, covered: 0, excused: 0 },
  );
  const share = (n: number) => (total.marked === 0 ? 0 : Math.round((n / total.marked) * 100));
  const complete = coverage.expected === 0 ? 0 : Math.min(100, Math.round((coverage.recorded / coverage.expected) * 100));
  const unmarked = Math.max(0, coverage.expected - coverage.recorded);

  const box = (label: string, value: string, colour = "#0f4c8a", sub?: string) => (
    <div style={{ flex: 1, minWidth: 140, border: "1px solid #d9e0e7", borderRadius: 10, padding: 12, background: "white" }}>
      <div style={{ color: "#6b7a90", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: colour }}>{value}</div>
      {sub && <div style={{ color: "#6b7a90", fontSize: 12 }}>{sub}</div>}
    </div>
  );

  const single = matches.length === 1 ? matches[0] : undefined;
  const current = sections.find((s) => s.key === detail);

  return (
    <div>
      <h2>{locked ? "Stage statistics" : "All stages statistics"}</h2>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Stage{" "}
          <select value={stage} disabled={locked} onChange={(e) => setStage(e.target.value as StageName | "all")}>
            {!locked && <option value="all">All stages</option>}
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Search teacher{" "}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or subject" />
        </label>
        <label>
          Show{" "}
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={searching || detailOpen}>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={0}>All</option>
          </select>
        </label>
      </div>

      {current ? (
        <StatsDetail
          section={current}
          records={records}
          rows={rows}
          types={types}
          stage={stage}
          from={from}
          to={to}
          search={search}
          onBack={() => setDetail(null)}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {box("Duties marked", String(total.marked), "#0f4c8a", `${rows.length} people`)}
            {box("Attendance rate", `${share(total.present)}%`, "#1f7a4d", "present ÷ marked")}
            {box("Late rate", `${share(total.late)}%`, "#b5651d")}
            {box("Missed rate", `${share(total.absent)}%`, "#a63a2b")}
            {box("Hours on duty", total.hours.toFixed(1), "#1b6fd1", `${rows.length ? (total.hours / rows.length).toFixed(1) : "0.0"} per person`)}
            {box("Substitutions", String(total.covered), "#7a4fb0", `${total.excused} duties excused`)}
            {box(
              "Data completeness",
              `${complete}%`,
              complete >= 90 ? "#1f7a4d" : complete >= 70 ? "#b5651d" : "#a63a2b",
              `${unmarked} scheduled duties have no mark`,
            )}
          </div>

          {searching && rows.length > 0 && matches.length === 0 && (
            <div style={{ ...card, color: "#6b7a90", marginBottom: 16 }}>
              No teacher with marked duties matches "{search}" in this period.
            </div>
          )}

          {single && (
            <div style={{ ...card, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>
                {single.person.fullName} {single.person.subject && <small style={{ color: "#6b7a90" }}>({single.person.subject})</small>}
              </h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {box("Attended", String(single.present), "#1f7a4d")}
                {box("Late", String(single.late), "#b5651d")}
                {box("Missed", String(single.absent), "#a63a2b")}
                {box("Attendance rate", single.marked ? `${single.rate}%` : "-", "#1b6fd1")}
                {box("Hours on duty", single.hours.toFixed(1), "#1b6fd1")}
                {box("Substitute", String(single.covered), "#7a4fb0")}
                {box("Excused", String(single.excused), "#7a4fb0")}
              </div>
            </div>
          )}

      {stage === "all" && staff.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <NormalLoadCard
            teachers={staff.filter((u) => u.role === "teacher")}
            normal={normal}
            done={Object.fromEntries(rows.map((r) => [r.person.id, r.present + r.late]))}
            from={from}
            to={to}
            limit={limit}
            search={search}
            onPick={setSearch}
          />
        </div>
      )}

          {rows.length === 0 ? (
            <div style={{ ...card, color: "#6b7a90", textAlign: "center" }}>No marked duties in this period.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
              {sections.map((s) => (
                <SectionCard
                  key={s.key}
                  section={s}
                  rows={rows}
                  matches={matches}
                  searching={searching}
                  limit={limit}
                  onOpen={() => setDetail(s.key)}
                />
              ))}
            </div>
          )}

          <div style={{ ...card, marginTop: 16, color: "#556274", fontSize: 13 }}>
            <b>How the numbers are counted</b>
            <ul style={{ marginBottom: 0 }}>
              <li>Only duties with an attendance mark are counted. Unmarked duties are not counted as missed.</li>
              <li>Attendance rate = present divided by all marked duties. Late and missed lower the rate.</li>
              <li>Hours count when the person was present or late, from the duty's start and end time.</li>
              <li>Excused: the duty was covered by a substitute. It is not missed, and the substitute is counted instead.</li>
              <li>Data completeness = marked duties divided by scheduled duties up to today. Below 90%, treat the rankings with care.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}