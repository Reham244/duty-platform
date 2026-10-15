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
// ---------- Shapes sent between the screens and the server ----------
export interface AttendanceRow {
  record: AttendanceRecord;
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