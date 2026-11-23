import type { StatsRow } from "./api";
import type { StatRecord } from "./types";

// One measure shown in Statistics. The cards use value/show/best/format; the detail page uses the rest.
export interface Section {
  key: string;
  title: string;
  note: string;
  colour: string;
  value: (r: StatsRow) => number;
  show: (r: StatsRow) => boolean; // who is ranked on the card
  best: "high" | "low"; // which end comes first
  format: (n: number) => string;
  scaleMax?: number; // for percentages
  events: (r: StatRecord) => boolean; // which records belong to this measure
  who: "person" | "excused"; // whose number each record counts for
  measure: "count" | "hours" | "rate";
  ofDuties?: boolean; // also show the share of the person's own marked duties
}

const count = (n: number) => String(n);
const percent = (n: number) => `${n}%`;
const hours = (n: number) => `${n.toFixed(1)} h`;
const enough = (r: StatsRow) => r.marked >= 3;
const marked = (r: StatRecord) => r.status === "present" || r.status === "late" || r.status === "absent";

export const sections: Section[] = [
  {
    key: "late", title: "Late arrivals", note: "Duties marked Late. Most late first.", colour: "#b5651d",
    value: (r) => r.late, show: (r) => r.late > 0, best: "high", format: count,
    events: (r) => r.status === "late", who: "person", measure: "count", ofDuties: true,
  },
  {
    key: "absent", title: "Missed duties", note: "Duties marked Absent. Excused duties are not counted.", colour: "#a63a2b",
    value: (r) => r.absent, show: (r) => r.absent > 0, best: "high", format: count,
    events: (r) => r.status === "absent", who: "person", measure: "count", ofDuties: true,
  },
  {
    key: "low", title: "Lowest attendance rate", note: "Present divided by marked duties. Only people with at least 3 marked duties.", colour: "#a63a2b",
    value: (r) => r.rate, show: enough, best: "low", format: percent, scaleMax: 100,
    events: marked, who: "person", measure: "rate",
  },
  {
    key: "best", title: "Best attendance rate", note: "Present divided by marked duties. Only people with at least 3 marked duties.", colour: "#1f7a4d",
    value: (r) => r.rate, show: enough, best: "high", format: percent, scaleMax: 100,
    events: marked, who: "person", measure: "rate",
  },
  {
    key: "hours", title: "Hours on duty (workload)", note: "Hours when present or late, including duties taken as a substitute.", colour: "#1b6fd1",
    value: (r) => r.hours, show: (r) => r.hours > 0, best: "high", format: hours,
    events: (r) => r.status === "present" || r.status === "late", who: "person", measure: "hours",
  },
  {
    key: "covered", title: "Substitutes", note: "Duties taken for another teacher.", colour: "#7a4fb0",
    value: (r) => r.covered, show: (r) => r.covered > 0, best: "high", format: count,
    events: (r) => r.kind === "substitute", who: "person", measure: "count",
  },
  {
    key: "excused", title: "Excused", note: "Own duties that someone else covered. Not counted as missed.", colour: "#7a4fb0",
    value: (r) => r.excused, show: (r) => r.excused > 0, best: "high", format: count,
    events: (r) => r.kind === "substitute", who: "excused", measure: "count",
  },
];