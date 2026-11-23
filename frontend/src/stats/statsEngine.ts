import type { StatRecord } from "../types";

// ---------- The four outcomes ----------
// Every marked duty ends in exactly one of on time, late or absent.
// Excused is separate: the duty was covered by a substitute, so it is neither missed nor counted in the rates.
export type Outcome = "onTime" | "late" | "absent" | "excused";

export interface Tally {
  onTime: number;
  late: number;
  absent: number;
  excused: number;
  marked: number; // onTime + late + absent. This is the base of every rate.
  attended: number; // onTime + late: the person came
  hours: number; // hours on duty, when on time or late
  covered: number; // duties taken as a substitute
}

export const emptyTally = (): Tally => ({ onTime: 0, late: 0, absent: 0, excused: 0, marked: 0, attended: 0, hours: 0, covered: 0 });

// Whole percent. Returns 0 when there is nothing to divide by.
export const share = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part / whole) * 100));

export function ratesOf(t: Tally) {
  return {
    onTime: share(t.onTime, t.marked),
    late: share(t.late, t.marked),
    absent: share(t.absent, t.marked),
    attended: share(t.attended, t.marked),
  };
}

// ---------- Facts: what happened to whom ----------
export interface Fact {
  personId: number;
  personName: string;
  subject: string | null;
  outcome: Outcome | "pending"; // pending: a substitution that has not been marked yet
  asSubstitute: boolean;
  record: StatRecord;
}

const outcomeOf = (status: StatRecord["status"]): Outcome | "pending" =>
  status === "present" ? "onTime" : status === "late" ? "late" : status === "absent" ? "absent" : "pending";

// A normal record is one fact. A substitution is two: the substitute does the duty, the original teacher is excused.
export function factsOf(records: StatRecord[]): Fact[] {
  const out: Fact[] = [];
  for (const r of records) {
    if (r.kind === "own") {
      out.push({ personId: r.personId, personName: r.personName, subject: r.subject, outcome: outcomeOf(r.status), asSubstitute: false, record: r });
      continue;
    }
    out.push({ personId: r.personId, personName: r.personName, subject: r.subject, outcome: outcomeOf(r.status), asSubstitute: true, record: r });
    if (r.excusedId !== null) {
      out.push({ personId: r.excusedId, personName: r.excusedName ?? "?", subject: r.excusedSubject, outcome: "excused", asSubstitute: false, record: r });
    }
  }
  return out;
}

// Adds up the facts, for everyone or for one person.
export function tallyOf(facts: Fact[], personId?: number): Tally {
  const t = emptyTally();
  for (const f of facts) {
    if (personId !== undefined && f.personId !== personId) continue;
    if (f.asSubstitute) t.covered += 1;
    if (f.outcome === "onTime") {
      t.onTime += 1;
      t.hours += f.record.hours;
    } else if (f.outcome === "late") {
      t.late += 1;
      t.hours += f.record.hours;
    } else if (f.outcome === "absent") {
      t.absent += 1;
    } else if (f.outcome === "excused") {
      t.excused += 1;
    }
  }
  t.marked = t.onTime + t.late + t.absent;
  t.attended = t.onTime + t.late;
  return t;
}

// ---------- Breakdowns ----------
export type Dimension = "stage" | "type" | "day" | "person" | "place";
export interface Slice {
  key: string;
  label: string;
  tally: Tally;
}

export const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function breakdown(facts: Fact[], by: Dimension, typeName: (code: string) => string = (code) => code): Slice[] {
  const groups = new Map<string, { label: string; facts: Fact[] }>();
  for (const f of facts) {
    const r = f.record;
    const [key, label]: [string, string] =
      by === "stage"
        ? [r.stage, r.stage]
        : by === "type"
          ? [r.type, typeName(r.type)]
          : by === "day"
            ? [String(r.day), dayNames[r.day] ?? String(r.day)]
            : by === "place"
              ? [r.place, r.place]
              : [String(f.personId), f.personName];
    const group = groups.get(key) ?? { label, facts: [] };
    group.facts.push(f);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, g]) => ({ key, label: g.label, tally: tallyOf(g.facts) }));
}

// ---------- Repeated behaviour ----------
// "slot": the same duty (stage, type, place, weekday, time). "day": the same weekday. "type": the same duty type.
export type PatternGroup = "slot" | "day" | "type";

export interface Pattern {
  personId: number;
  personName: string;
  subject: string | null;
  kind: "late" | "absent";
  group: PatternGroup;
  key: string;
  sample: StatRecord; // one record of the group, to describe it on screen
  count: number; // how many times it happened
  total: number; // marked occurrences in this group
  share: number; // count as a percent of total
  streak: number; // the longest run in a row
  lastDate: string;
}

export interface PatternOptions {
  minCount?: number; // default 2
  minShare?: number; // default 0 (percent)
}

// Finds a person who is late or absent again and again in the same place. Substitute duties are not included.
export function repeatPatterns(facts: Fact[], group: PatternGroup, options: PatternOptions = {}): Pattern[] {
  const minCount = options.minCount ?? 2;
  const minShare = options.minShare ?? 0;
  const keyOf = (r: StatRecord) =>
    group === "slot" ? `${r.stage}|${r.type}|${r.place}|${r.day}|${r.start}` : group === "day" ? String(r.day) : r.type;

  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    if (f.asSubstitute) continue;
    if (f.outcome !== "onTime" && f.outcome !== "late" && f.outcome !== "absent") continue;
    const k = `${f.personId}#${keyOf(f.record)}`;
    const list = groups.get(k) ?? [];
    list.push(f);
    groups.set(k, list);
  }

  const out: Pattern[] = [];
  for (const [key, list] of groups) {
    const ordered = [...list].sort((a, b) => a.record.date.localeCompare(b.record.date));
    const first = ordered[0];
    if (!first) continue;
    for (const kind of ["late", "absent"] as const) {
      const hits = ordered.filter((f) => f.outcome === kind);
      if (hits.length < minCount) continue;
      const pct = share(hits.length, ordered.length);
      if (pct < minShare) continue;
      let streak = 0;
      let run = 0;
      for (const f of ordered) {
        run = f.outcome === kind ? run + 1 : 0;
        streak = Math.max(streak, run);
      }
      out.push({
        personId: first.personId,
        personName: first.personName,
        subject: first.subject,
        kind,
        group,
        key,
        sample: first.record,
        count: hits.length,
        total: ordered.length,
        share: pct,
        streak,
        lastDate: hits[hits.length - 1]?.record.date ?? "",
      });
    }
  }
  return out.sort((a, b) => b.count - a.count || b.streak - a.streak || a.personName.localeCompare(b.personName));
}