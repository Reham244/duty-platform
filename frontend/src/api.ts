import { attendanceRecords, duties, users } from "./data/dummyData";
import type { AttendanceRecord, Duty, User } from "./types";

export async function getUsers(): Promise<User[]> {
  return users;
}

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