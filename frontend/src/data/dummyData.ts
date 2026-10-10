import type { AttendanceRecord, Duty, DutyTypeInfo, StageName, User } from "../types";

export const stages: StageName[] = ["Foundation", "Elementary", "Middle", "High"];

export const dutyTypes: DutyTypeInfo[] = [
  { code: "snack", name: "Snack", colour: "#2f6fb5", weight: 1 },
  { code: "break", name: "Break", colour: "#c9820a", weight: 1 },
  { code: "dismissal", name: "Dismissal", colour: "#7a4fb0", weight: 1 },
];

export const users: User[] = [
  { id: 1, fullName: "Teacher 43", role: "teacher", subject: "French" },
  { id: 2, fullName: "Supervisor 01", role: "supervisor" },
  { id: 3, fullName: "Head of Elementary", role: "head_of_stage", homeStage: "Elementary" },
  { id: 4, fullName: "Admin 01", role: "admin" },
  { id: 5, fullName: "Teacher 14", role: "teacher", homeStage: "Elementary", subject: "ELA" },
  { id: 6, fullName: "Teacher 15", role: "teacher", homeStage: "Elementary", subject: "Science" },
  { id: 7, fullName: "Teacher 16", role: "teacher", homeStage: "Elementary", subject: "Arabic" },
  { id: 8, fullName: "Teacher 17", role: "teacher", homeStage: "Elementary", subject: "STEM" },
  { id: 9, fullName: "Teacher 18", role: "teacher", homeStage: "Elementary", subject: "Social Studies" },
];

export const duties: Duty[] = [
  { id: 1, userId: 1, stage: "Foundation", type: "dismissal", place: "Gate 7", day: 0, start: "14:00", end: "14:15" },
  { id: 2, userId: 1, stage: "Foundation", type: "snack", place: "Basketball Field", day: 2, start: "08:45", end: "09:00" },
  { id: 3, userId: 1, stage: "Foundation", type: "break", place: "Soccer Field", day: 3, start: "12:00", end: "12:30" },
  { id: 4, userId: 1, stage: "Foundation", type: "break", place: "Rainbow Lane", day: 4, start: "12:00", end: "12:30" },
  { id: 5, userId: 1, stage: "Elementary", type: "dismissal", place: "Garage", day: 0, start: "14:20", end: "14:35" },
  { id: 6, userId: 1, stage: "Elementary", type: "dismissal", place: "Basketball", day: 1, start: "14:20", end: "14:35" },
  { id: 7, userId: 1, stage: "Elementary", type: "dismissal", place: "Gate 7", day: 2, start: "14:20", end: "14:35" },
  { id: 8, userId: 1, stage: "Elementary", type: "snack", place: "Basketball Field", day: 4, start: "09:05", end: "09:20" },
  { id: 9, userId: 1, stage: "Middle", type: "break", place: "Soccer Field", day: 0, start: "13:10", end: "13:40" },
  { id: 10, userId: 1, stage: "Middle", type: "break", place: "Rainbow Lane", day: 1, start: "13:10", end: "13:40" },
  { id: 11, userId: 1, stage: "Middle", type: "break", place: "Cafeteria", day: 2, start: "13:10", end: "13:40" },
  { id: 12, userId: 1, stage: "Middle", type: "dismissal", place: "Garage", day: 3, start: "14:40", end: "14:55" },
  { id: 13, userId: 1, stage: "Middle", type: "dismissal", place: "Gate 7", day: 4, start: "14:40", end: "14:55" },
  // Elementary break on Wednesday: other teachers
  { id: 14, userId: 5, stage: "Elementary", type: "break", place: "Soccer Field", day: 3, start: "12:35", end: "13:05" },
  { id: 15, userId: 6, stage: "Elementary", type: "break", place: "Basketball Field", day: 3, start: "12:35", end: "13:05" },
  { id: 16, userId: 7, stage: "Elementary", type: "break", place: "Rainbow Lane", day: 3, start: "12:35", end: "13:05" },
  { id: 17, userId: 8, stage: "Elementary", type: "break", place: "Cafeteria", day: 3, start: "12:35", end: "13:05" },
  { id: 18, userId: 9, stage: "Elementary", type: "break", place: "Cafeteria", day: 3, start: "12:35", end: "13:05" },
];

export const attendanceRecords: AttendanceRecord[] = [
  { id: 1, dutyId: 1, date: "2026-10-04", status: "present" },
  { id: 2, dutyId: 1, date: "2026-09-27", status: "present" },
  { id: 3, dutyId: 1, date: "2026-09-20", status: "present" },
  { id: 4, dutyId: 5, date: "2026-10-04", status: "present" },
  { id: 5, dutyId: 5, date: "2026-09-27", status: "late" },
  { id: 6, dutyId: 6, date: "2026-10-05", status: "late" },
  { id: 7, dutyId: 6, date: "2026-09-28", status: "present" },
  { id: 8, dutyId: 7, date: "2026-10-06", status: "present" },
  { id: 9, dutyId: 7, date: "2026-09-29", status: "present" },
  { id: 10, dutyId: 2, date: "2026-10-06", status: "present" },
  { id: 11, dutyId: 2, date: "2026-09-29", status: "present" },
  { id: 12, dutyId: 9, date: "2026-10-04", status: "present" },
  { id: 13, dutyId: 9, date: "2026-09-27", status: "present" },
  { id: 14, dutyId: 13, date: "2026-10-01", status: "absent" },
  { id: 15, dutyId: 13, date: "2026-09-24", status: "present" },
  { id: 16, dutyId: 12, date: "2026-09-30", status: "present" },
  { id: 17, dutyId: 12, date: "2026-09-23", status: "present" },
];