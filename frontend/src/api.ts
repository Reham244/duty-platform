import {
  attendanceRecords, dutyTypes, duties, emergencyReports, stages, substitutions, users,
} from "./data/dummyData";
import type {
  AttendanceRecord, AttendanceStatus, CardStatus, Duty, DutyTypeInfo, EmergencyReport,
  StageName, SubStatus, Substitution, User,
} from "./types";

const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

// ---------- Dates (demo) ----------
export const demoWeekStart = "2026-10-04"; // a Sunday

export function dateOfDay(day: number): string {
  const d = new Date(demoWeekStart + "T12:00:00");
  d.setDate(d.getDate() + day);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(a: Duty, b: Duty): boolean {
  return minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}

export function dutyHours(d: Duty): number {
  return (minutes(d.end) - minutes(d.start)) / 60;
}

// ---------- Lists ----------
export async function getUsers(): Promise<User[]> {
  return [...users];
}

export async function getStages(): Promise<StageName[]> {
  return stages;
}

export async function getDutyTypes(): Promise<DutyTypeInfo[]> {
    return [...dutyTypes];
}

// ---------- Teacher ----------
export async function getMyDuties(userId: number): Promise<Duty[]> {
  return duties.filter((d) => d.userId === userId);
}

export interface AttendanceRow {
  record: AttendanceRecord;
  duty: Duty;
}

export async function getMyAttendance(userId: number): Promise<AttendanceRow[]> {
  const mine = duties.filter((d) => d.userId === userId);
  return attendanceRecords
    .filter((r) => mine.some((d) => d.id === r.dutyId))
    .map((r) => ({ record: r, duty: mine.find((d) => d.id === r.dutyId)! }))
    .sort((a, b) => b.record.date.localeCompare(a.record.date));
}

let nextReportId = 1;

export async function reportEmergency(userId: number, date: string, message: string): Promise<void> {
  const exists = emergencyReports.some((e) => e.userId === userId && e.date === date);
  if (exists) return;
  emergencyReports.push({ id: nextReportId++, userId, date, message, status: "open" });
}

export async function hasEmergency(userId: number, date: string): Promise<boolean> {
  return emergencyReports.some((e) => e.userId === userId && e.date === date);
}

export interface SubstituteDuty {
  substitution: Substitution;
  duty: Duty;
}

export async function getMySubstituteDuties(userId: number): Promise<SubstituteDuty[]> {
  return substitutions
    .filter((s) => s.substituteId === userId)
    .map((s) => ({ substitution: s, duty: duties.find((d) => d.id === s.dutyId)! }))
    .sort((a, b) => b.substitution.date.localeCompare(a.substitution.date));
}

// ---------- Attendance cards ----------
export interface Card {
  duty: Duty;
  person: User;
  status: CardStatus;
  emergency: boolean; // an emergency was reported and nobody covers it yet
  substitution?: { id: number; person: User; status: SubStatus };
}

export async function getCards(stage: StageName | "all", day: number, date: string): Promise<Card[]> {
  return duties
    .filter((d) => (stage === "all" || d.stage === stage) && d.day === day)
    .sort(byTime)
    .map((d) => {
      const sub = substitutions.find((s) => s.dutyId === d.id && s.date === date);
      const record = attendanceRecords.find((r) => r.dutyId === d.id && r.date === date);
      const reported = emergencyReports.some((e) => e.userId === d.userId && e.date === date);
      return {
        duty: d,
        person: users.find((u) => u.id === d.userId)!,
        status: sub ? "substituted" : record ? record.status : "unmarked",
        emergency: reported && !sub,
        substitution: sub
          ? { id: sub.id, person: users.find((u) => u.id === sub.substituteId)!, status: sub.status }
          : undefined,
      };
    });
}

let nextRecordId = 1000;

export async function markAttendance(dutyId: number, date: string, status: AttendanceStatus): Promise<void> {
  const record = attendanceRecords.find((r) => r.dutyId === dutyId && r.date === date);
  if (record) {
    record.status = status;
  } else {
    attendanceRecords.push({ id: nextRecordId++, dutyId, date, status });
  }
}

export async function markSubstituteAttendance(substitutionId: number, status: AttendanceStatus): Promise<void> {
  const sub = substitutions.find((s) => s.id === substitutionId);
  if (sub) sub.status = status;
}

// ---------- Substitutions ----------
export interface NeedRow {
  report: EmergencyReport;
  person: User;
  duty: Duty;
}

// Duties of teachers with an open emergency report that nobody covers yet.
export async function getNeedsSubstitute(date: string, stage: StageName | "all"): Promise<NeedRow[]> {
  const out: NeedRow[] = [];
  for (const report of emergencyReports.filter((e) => e.date === date && e.status === "open")) {
    const person = users.find((u) => u.id === report.userId)!;
    duties
      .filter(
        (d) =>
          d.userId === report.userId &&
          d.day === weekdayOf(date) &&
          (stage === "all" || d.stage === stage) &&
          !substitutions.some((s) => s.dutyId === d.id && s.date === date),
      )
      .forEach((duty) => out.push({ report, person, duty }));
  }
  return out.sort((a, b) => a.duty.start.localeCompare(b.duty.start));
}

export interface Candidate {
  person: User;
  count: number; // substitutions done so far
}

// Teachers with no duty at that time, no other cover at that time, and no emergency that day.
export async function getAvailableSubstitutes(duty: Duty, date: string): Promise<Candidate[]> {
  const day = weekdayOf(date);
  return users
    .filter((u) => u.role === "teacher" && u.id !== duty.userId)
    .filter((u) => {
      const busyDuty = duties.some((d) => d.userId === u.id && d.day === day && overlaps(d, duty));
      const busyCover = substitutions.some(
        (s) => s.substituteId === u.id && s.date === date && overlaps(duties.find((d) => d.id === s.dutyId)!, duty),
      );
      const absent = emergencyReports.some((e) => e.userId === u.id && e.date === date);
      return !busyDuty && !busyCover && !absent;
    })
    .map((u) => ({ person: u, count: substitutions.filter((s) => s.substituteId === u.id).length }))
    .sort((a, b) => a.count - b.count || a.person.fullName.localeCompare(b.person.fullName));
}

let nextSubId = 100;

export async function addSubstitution(dutyId: number, date: string, substituteId: number, reason: string): Promise<void> {
  const duty = duties.find((d) => d.id === dutyId);
  if (!duty) return;

  // The original teacher is excused, so remove any mark they already had.
  const i = attendanceRecords.findIndex((r) => r.dutyId === dutyId && r.date === date);
  if (i >= 0) attendanceRecords.splice(i, 1);

  const existing = substitutions.find((s) => s.dutyId === dutyId && s.date === date);
  if (existing) {
    existing.substituteId = substituteId;
    existing.reason = reason;
    existing.status = "unmarked";
  } else {
    substitutions.push({ id: nextSubId++, dutyId, date, substituteId, reason, status: "unmarked" });
  }

  // When every duty of that teacher on that day is covered, the report is handled.
  const left = duties.some(
    (d) => d.userId === duty.userId && d.day === weekdayOf(date) && !substitutions.some((s) => s.dutyId === d.id && s.date === date),
  );
  if (!left) {
    emergencyReports.filter((e) => e.userId === duty.userId && e.date === date).forEach((e) => (e.status = "handled"));
  }
}

export interface SubRow {
  substitution: Substitution;
  duty: Duty;
  original: User;
  substitute: User;
}

export async function getSubstitutionsOn(date: string, stage: StageName | "all"): Promise<SubRow[]> {
  return substitutions
    .filter((s) => s.date === date)
    .map((s) => {
      const duty = duties.find((d) => d.id === s.dutyId)!;
      return {
        substitution: s,
        duty,
        original: users.find((u) => u.id === duty.userId)!,
        substitute: users.find((u) => u.id === s.substituteId)!,
      };
    })
    .filter((r) => stage === "all" || r.duty.stage === stage)
    .sort((a, b) => a.duty.start.localeCompare(b.duty.start));
}

// ---------- Statistics ----------
export interface StatsRow {
  person: User;
  present: number;
  late: number;
  absent: number;
  marked: number; // present + late + absent
  rate: number; // present / marked, in percent
  hours: number; // hours on duty (present and late)
}

function tally(rows: Map<number, StatsRow>, person: User, duty: Duty, status: AttendanceStatus) {
  let row = rows.get(person.id);
  if (!row) {
    row = { person, present: 0, late: 0, absent: 0, marked: 0, rate: 0, hours: 0 };
    rows.set(person.id, row);
  }
  row[status] += 1;
  row.marked += 1;
  if (status !== "absent") row.hours += dutyHours(duty);
}

export async function getStats(stage: StageName | "all", from: string, to: string): Promise<StatsRow[]> {
  const rows = new Map<number, StatsRow>();

  for (const r of attendanceRecords) {
    if (r.date < from || r.date > to) continue;
    const duty = duties.find((d) => d.id === r.dutyId);
    if (!duty || (stage !== "all" && duty.stage !== stage)) continue;
    const person = users.find((u) => u.id === duty.userId);
    if (person) tally(rows, person, duty, r.status);
  }

  // Duties done as a substitute count for the substitute. Excused originals are not counted.
  for (const s of substitutions) {
    if (s.date < from || s.date > to || s.status === "unmarked") continue;
    const duty = duties.find((d) => d.id === s.dutyId);
    if (!duty || (stage !== "all" && duty.stage !== stage)) continue;
    const person = users.find((u) => u.id === s.substituteId);
    if (person) tally(rows, person, duty, s.status);
  }

  const list = [...rows.values()];
  list.forEach((row) => {
    row.rate = Math.round((row.present / row.marked) * 100);
  });
  return list.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
}

// ---------- Manage schedule ----------
export async function getStageDuties(stage: StageName | "all"): Promise<Duty[]> {
  return duties.filter((d) => stage === "all" || d.stage === stage);
}

export interface NewDuty {
  stage: StageName;
  type: string;
  place: string;
  day: number;
  start: string;
  end: string;
  userId: number;
}

let nextDutyId = 500;

// Returns an error message, or null when the duty was saved.
export async function addDuty(n: NewDuty): Promise<string | null> {
  if (!n.type) return "Choose a duty type.";
  if (!n.userId) return "Choose a teacher.";
  if (!n.place.trim()) return "Type a place.";
  if (minutes(n.end) <= minutes(n.start)) return "The end time must be after the start time.";

  const draft: Duty = {
    id: nextDutyId,
    userId: n.userId,
    stage: n.stage,
    type: n.type,
    place: n.place.trim(),
    day: n.day,
    start: n.start,
    end: n.end,
  };
  const clash = duties.find((d) => d.userId === n.userId && d.day === n.day && overlaps(d, draft));
  if (clash) {
    return `This teacher already has a duty at that time (${clash.place}, ${clash.stage}, ${clash.start} to ${clash.end}).`;
  }
  nextDutyId += 1;
  duties.push(draft);
  return null;
}

export async function deleteDuty(id: number): Promise<string | null> {
  const used = attendanceRecords.some((r) => r.dutyId === id) || substitutions.some((s) => s.dutyId === id);
  if (used) return "This duty has attendance history, so it cannot be deleted.";
  const i = duties.findIndex((d) => d.id === id);
  if (i >= 0) duties.splice(i, 1);
  return null;
}

export async function getDutyTypeCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  duties.forEach((d) => {
    out[d.type] = (out[d.type] ?? 0) + 1;
  });
  return out;
}

export async function addDutyType(name: string, colour: string, weight: number): Promise<string | null> {
  const code = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!code) return "Type a name.";
  if (dutyTypes.some((t) => t.code === code)) return "A duty type with this name already exists.";
  dutyTypes.push({ code, name: name.trim(), colour, weight });
  return null;
}