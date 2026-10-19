import type { Duty, StageName } from "./types";

export interface Column {
  key: string;
  label: string;
  kind: "session" | "snack" | "break" | "dismissal";
  start?: string;
  end?: string;
}

// Dummy bell times for each stage. The real times come from the timetable (LMS) later.
interface Spec {
  start: string; // the first session starts
  snack1: [string, string];
  snack2Minutes: number; // length of the second snack
  breakAt: [string, string];
  dismissal: [string, string];
}

const specs: Record<StageName, Spec> = {
  Foundation: { start: "07:35", snack1: ["08:45", "09:00"], snack2Minutes: 10, breakAt: ["12:00", "12:30"], dismissal: ["14:00", "14:15"] },
  Elementary: { start: "07:55", snack1: ["09:05", "09:20"], snack2Minutes: 10, breakAt: ["12:35", "13:05"], dismissal: ["14:20", "14:35"] },
  "Middle & High": { start: "08:15", snack1: ["09:25", "09:40"], snack2Minutes: 10, breakAt: ["13:10", "13:40"], dismissal: ["14:40", "14:55"] },
};

const toMin = (t: string): number => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};
const toText = (n: number): string => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const cache = new Map<StageName, Column[]>();

// The day of one stage: sessions 1 and 2, snack 1, sessions 3 and 4, snack 2, sessions 5 to 7, break,
// sessions 8 to 10, dismissal. Sessions share the time between the fixed points equally.
export function columnsForStage(stage: StageName): Column[] {
  const cached = cache.get(stage);
  if (cached) return cached;

  const sp = specs[stage];
  const dayStart = toMin(sp.start);
  const s1a = toMin(sp.snack1[0]);
  const s1b = toMin(sp.snack1[1]);
  const ba = toMin(sp.breakAt[0]);
  const bb = toMin(sp.breakAt[1]);
  const da = toMin(sp.dismissal[0]);

  const cols: Column[] = [];
  let no = 0;
  const sessions = (from: number, to: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.round(from + ((to - from) * i) / count);
      const b = Math.round(from + ((to - from) * (i + 1)) / count);
      no += 1;
      cols.push({ key: `s${no}`, label: `Session ${no}`, kind: "session", start: toText(a), end: toText(b) });
    }
  };

  sessions(dayStart, s1a, 2);
  cols.push({ key: "snack1", label: "Snack 1", kind: "snack", start: sp.snack1[0], end: sp.snack1[1] });
  const l = (ba - s1b - sp.snack2Minutes) / 5; // length of sessions 3 to 7
  sessions(s1b, s1b + 2 * l, 2);
  const s2a = Math.round(s1b + 2 * l);
  const s2b = s2a + sp.snack2Minutes;
  cols.push({ key: "snack2", label: "Snack 2", kind: "snack", start: toText(s2a), end: toText(s2b) });
  sessions(s2b, ba, 3);
  cols.push({ key: "break", label: "Break", kind: "break", start: sp.breakAt[0], end: sp.breakAt[1] });
  sessions(bb, da, 3);
  cols.push({ key: "dismissal", label: "Dismissal", kind: "dismissal", start: sp.dismissal[0], end: sp.dismissal[1] });

  cache.set(stage, cols);
  return cols;
}

// The same columns without times, for screens that mix several stages.
export const genericColumns: Column[] = columnsForStage("Elementary").map((c) => ({
  key: c.key,
  label: c.label,
  kind: c.kind,
}));

// The column a duty belongs to: the one it overlaps most. Null when it fits none (for example after school).
export function columnKeyFor(duty: Duty): string | null {
  const a = toMin(duty.start);
  const b = toMin(duty.end);
  let best: string | null = null;
  let bestOverlap = 0;
  for (const c of columnsForStage(duty.stage)) {
    if (!c.start || !c.end) continue;
    const overlap = Math.min(b, toMin(c.end)) - Math.max(a, toMin(c.start));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c.key;
    }
  }
  return best;
}