export type Role = "teacher" | "supervisor" | "head_of_stage" | "admin";
export type StageName = "Foundation" | "Elementary" | "Middle" | "High";

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
export type CardStatus = AttendanceStatus | "unmarked";

export interface AttendanceRecord {
  id: number;
  dutyId: number;
  date: string; // "2026-10-06"
  status: AttendanceStatus;
}