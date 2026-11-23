export type Role =
  | "teacher"
  | "supervisor"
  | "head_of_stage"
  | "admin"
  | "matron"
  | "hr";
export type StageName = "Foundation" | "Elementary" | "Middle & High";

export interface User {
  id: number;
  fullName: string;
  role: Role;
  homeStage?: StageName;
  subject?: string;
}

// A duty type is data, not fixed in the code, so new types can be added later.
export interface DutyTypeInfo {
  code: string; // "snack", "break", ...
  name: string; // what people read on screen
  colour: string;
  weight: number; // for workload later; not used yet
}

export interface Duty {
  id: number;
  userId: number;
  stage: StageName;
  type: string; // matches a DutyTypeInfo code
  place: string;
  day: number; // 0 = Sunday ... 4 = Thursday
  start: string; // "12:00"
  end: string;
}

export type AttendanceStatus = "present" | "late" | "absent";
export type SubStatus = AttendanceStatus | "unmarked";
export type CardStatus = AttendanceStatus | "unmarked" | "substituted";

export interface AttendanceRecord {
  id: number;
  dutyId: number;
  date: string; // "2026-10-06"
  status: AttendanceStatus;
}

export interface EmergencyReport {
  id: number;
  userId: number; // the teacher who cannot attend
  date: string;
  message: string;
  status: "open" | "handled";
}

export interface Substitution {
  id: number;
  dutyId: number; // the duty that is covered
  date: string;
  substituteId: number; // the teacher who covers it
  reason: string;
  status: SubStatus; // the substitute's own attendance
}
export type HistoryKind = "own" | "excused" | "substitute";

// One line of a teacher's history: an own duty, an excused duty, or a duty done as a substitute.
export interface AttendanceRow {
  id: string;
  date: string;
  status: AttendanceStatus | "excused";
  kind: HistoryKind;
  duty: Duty;
}

export interface SubstituteDuty {
  substitution: Substitution;
  duty: Duty;
}

export interface Card {
  duty: Duty;
  person: User;
  status: CardStatus;
  emergency: boolean; // an emergency was reported and nobody covers it yet
  substitution?: { id: number; person: User; status: SubStatus } | undefined;
}

export interface NeedRow {
  report: EmergencyReport;
  person: User;
  duty: Duty;
}

export interface Candidate {
  person: User;
  count: number; // substitutions done so far
}

export interface SubRow {
  substitution: Substitution;
  duty: Duty;
  original: User;
  substitute: User;
}

export interface StatsRow {
  person: User;
  present: number;
  late: number;
  absent: number;
  marked: number; // present + late + absent
  rate: number; // present / marked, in percent
  hours: number; // hours on duty (present and late)
  covered: number;
  excused: number;
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
export interface SubstitutionSummary {
  covered: number;
  excused: number;
}

export interface AppNotification {
  id: number;
  kind: string; // duty-reminder, substitution, excused
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  fromName: string | null;
}

export interface Coverage {
  expected: number; // scheduled duties in the period
  recorded: number; // duties with an attendance mark
}

export interface AuditEntry {
  id: number;
  createdAt: string;
  actorId: number | null;
  actorName: string;
  actorRole: string | null;
  action: string;
  summary: string;
  details: string | null;
  outcome: "ok" | "denied" | "error";
}

// One line behind the statistics: a marked duty, or a substitution.
export interface StatRecord {
  id: string;
  date: string;
  kind: "own" | "substitute";
  status: "present" | "late" | "absent" | "unmarked";
  personId: number; // the person counted: the assigned teacher, or the substitute
  personName: string;
  subject: string | null;
  excusedId: number | null; // for a substitution: the teacher who was excused
  excusedName: string | null;
  excusedSubject: string | null;
  stage: StageName;
  type: string;
  place: string;
  day: number;
  start: string;
  end: string;
  hours: number;
  byName: string | null; // who marked it, or who added the substitution
}
export interface SystemLogEntry {
  id: number;
  createdAt: string;
  level: "info" | "warn" | "error";
  source: string; // http, db, scheduler, app
  method: string | null;
  path: string | null;
  status: number | null;
  durationMs: number | null;
  userId: number | null;
  userName: string | null;
  message: string;
  details: string | null;
}

export interface SubstitutionRequest {
  id: number;
  dutyId: number;
  date: string;
  reason: string;
  status: "open" | "covered";
  createdAt: string;
  duty: Duty;
  substituteName: string | null;
}

export interface NormalDuties {
  default: number; // normal duties per week for the school
  perUser: Record<number, number>; // a different number for some people
}
