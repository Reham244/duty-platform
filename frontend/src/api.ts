import { attendanceRecords, dutyTypes, duties, stages, users } from "./data/dummyData";
import type { AttendanceRecord, AttendanceStatus, CardStatus, Duty, DutyTypeInfo, StageName, User } from "./types";

const byTime = (a: Duty, b: Duty) => a.start.localeCompare(b.start);

export async function getUsers(): Promise<User[]> {
  return users;
}

export async function getStages(): Promise<StageName[]> {
  return stages;
}

export async function getDutyTypes(): Promise<DutyTypeInfo[]> {
  return dutyTypes;
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

// One card = one person on one duty on one date.
export interface Card {
  duty: Duty;
  person: User;
  status: CardStatus;
}

export async function getCards(stage: StageName, day: number, date: string): Promise<Card[]> {
  return duties
    .filter((d) => d.stage === stage && d.day === day)
    .sort(byTime)
    .map((d) => {
      const record = attendanceRecords.find((r) => r.dutyId === d.id && r.date === date);
      return {
        duty: d,
        person: users.find((u) => u.id === d.userId)!,
        status: record ? record.status : "unmarked",
      };
    });
}

let nextRecordId = 1000;

export async function markAttendance(dutyId: number, date: string, status: AttendanceStatus): Promise<void> {
  const record = attendanceRecords.find((r) => r.dutyId === dutyId && r.date === date);
  if (record) {
    record.status = status; // change an existing mark
  } else {
    attendanceRecords.push({ id: nextRecordId++, dutyId, date, status });
  }
}