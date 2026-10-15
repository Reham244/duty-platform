import {
  attendanceRecords, dutyTypes, duties, emergencyReports, stages, substitutions, users,
} from "./data/dummyData.js";
import type {
  AttendanceRow, AttendanceStatus, Candidate, Card, Duty, DutyTypeInfo, NeedRow, NewDuty,
  Role, StageName, StatsRow, SubRow, SubstituteDuty, User,
} from "./types.js";

type StageFilter = StageName | "all";

const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

function minutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
    return h * 60 + m;
}

function overlaps(a: Duty, b: Duty): boolean {
  return minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}

function dutyHours(d: Duty): number {
  return (minutes(d.end) - minutes(d.start)) / 60;
}

// ---------- Finding things ----------
export const findUser = (id: number) => users.find((u) => u.id === id);
export const findDuty = (id: number) => duties.find((d) => d.id === id);

export function getSubstitutionStage(id: number): StageName | undefined {
  const sub = substitutions.find((s) => s.id === id);
  return sub ? findDuty(sub.dutyId)?.stage : undefined;
}

// ---------- Lists ----------
export const getUsers = (): User[] => [...users];
export const getStages = (): StageName[] => [...stages];
export const getDutyTypes = (): DutyTypeInfo[] => [...dutyTypes];

// ---------- A person's own data ----------
export const getMyDuties = (userId: number): Duty[] => duties.filter((d) => d.userId === userId);

export function getMyAttendance(userId: number): AttendanceRow[] {
  const mine = duties.filter((d) => d.userId === userId);
  return attendanceRecords
    .filter((r) => mine.some((d) => d.id === r.dutyId))
    .map((r) => ({ record: r, duty: mine.find((d) => d.id === r.dutyId)! }))
    .sort((a, b) => b.record.date.localeCompare(a.record.date));
}

let nextReportId = 1;

export function reportEmergency(userId: number, date: string, message: string): void {
  if (emergencyReports.some((e) => e.userId === userId && e.date === date)) return;
  emergencyReports.push({ id: nextReportId++, userId, date, message, status: "open" });
}

export const hasEmergency = (userId: number, date: string): boolean =>
  emergencyReports.some((e) => e.userId === userId && e.date === date);

export function getMySubstituteDuties(userId: number): SubstituteDuty[] {
  return substitutions
    .filter((s) => s.substituteId === userId)
    .map((s) => ({ substitution: s, duty: duties.find((d) => d.id === s.dutyId)! }))
    .sort((a, b) => b.substitution.date.localeCompare(a.substitution.date));
}

// ---------- Attendance cards ----------
export function getCards(stage: StageFilter, day: number, date: string): Card[] {
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

export function markAttendance(dutyId: number, date: string, status: AttendanceStatus): void {
  const record = attendanceRecords.find((r) => r.dutyId === dutyId && r.date === date);
  if (record) {
    record.status = status;
  } else {
    attendanceRecords.push({ id: nextRecordId++, dutyId, date, status });
  }
}

export function markSubstituteAttendance(substitutionId: number, status: AttendanceStatus): void {
  const sub = substitutions.find((s) => s.id === substitutionId);
  if (sub) sub.status = status;
}

// ---------- Substitutions ----------
export function getNeedsSubstitute(date: string, stage: StageFilter): NeedRow[] {
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

// Teachers with no duty at that time, no other cover at that time, and no emergency that day.
export function getAvailableSubstitutes(dutyId: number, date: string): Candidate[] {
  const duty = findDuty(dutyId);
  if (!duty) return [];
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

export function addSubstitution(dutyId: number, date: string, substituteId: number, reason: string): string | null {
  const duty = findDuty(dutyId);
  if (!duty) return "Duty not found.";
  if (!getAvailableSubstitutes(dutyId, date).some((c) => c.person.id === substituteId)) {
    return "This teacher is not free at that time.";
  }

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
    (d) =>
      d.userId === duty.userId &&
      d.day === weekdayOf(date) &&
      !substitutions.some((s) => s.dutyId === d.id && s.date === date),
  );
  if (!left) {
    emergencyReports.filter((e) => e.userId === duty.userId && e.date === date).forEach((e) => (e.status = "handled"));
  }
  return null;
}

export function getSubstitutionsOn(date: string, stage: StageFilter): SubRow[] {
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
function tally(rows: Map<number, StatsRow>, person: User, duty: Duty, status: AttendanceStatus): void {
  let row = rows.get(person.id);
  if (!row) {
    row = { person, present: 0, late: 0, absent: 0, marked: 0, rate: 0, hours: 0 };
    rows.set(person.id, row);
  }
  row[status] += 1;
  row.marked += 1;
  if (status !== "absent") row.hours += dutyHours(duty);
}

export function getStats(stage: StageFilter, from: string, to: string): StatsRow[] {
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
export const getStageDuties = (stage: StageFilter): Duty[] =>
  duties.filter((d) => stage === "all" || d.stage === stage);

let nextDutyId = 500;

// Returns an error message, or null when the duty was saved.
export function addDuty(n: NewDuty): string | null {
  if (!stages.includes(n.stage)) return "Unknown stage.";
  if (!dutyTypes.some((t) => t.code === n.type)) return "Choose a duty type.";
  if (!findUser(n.userId)) return "Choose a teacher.";
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

export function deleteDuty(id: number): string | null {
  const used = attendanceRecords.some((r) => r.dutyId === id) || substitutions.some((s) => s.dutyId === id);
  if (used) return "This duty has attendance history, so it cannot be deleted.";
  const i = duties.findIndex((d) => d.id === id);
  if (i >= 0) duties.splice(i, 1);
  return null;
}

// ---------- Duty types ----------
export function getDutyTypeCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  duties.forEach((d) => {
    out[d.type] = (out[d.type] ?? 0) + 1;
  });
  return out;
}

export function addDutyType(name: string, colour: string, weight: number): string | null {
  const code = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!code) return "Type a name.";
  if (dutyTypes.some((t) => t.code === code)) return "A duty type with this name already exists.";
  dutyTypes.push({ code, name: name.trim(), colour, weight });
  return null;
}

// ---------- Staff and roles ----------
const allRoles: Role[] = ["teacher", "supervisor", "head_of_stage", "admin", "matron", "hr"];

export function setUserRole(
  userId: number,
  role: Role,
  homeStage: StageName | undefined,
  actingUserId: number,
): string | null {
  const person = findUser(userId);
  if (!person) return "Person not found.";
  if (!allRoles.includes(role)) return "Unknown role.";
  if (userId === actingUserId && role !== "admin") return "You cannot remove your own admin role.";
  if (role === "head_of_stage" && !homeStage) return "Choose the stage this head of stage is responsible for.";
  person.role = role;
  if (homeStage) person.homeStage = homeStage;
  else delete person.homeStage;
    return null;
}