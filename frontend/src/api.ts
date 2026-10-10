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

// ---------- Statistics ----------

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function dutyHours(d: Duty): number {
  return (minutes(d.end) - minutes(d.start)) / 60;
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

export async function getStats(stage: StageName | "all", from: string, to: string): Promise<StatsRow[]> {
  const rows = new Map<number, StatsRow>();

  for (const r of attendanceRecords) {
    if (r.date < from || r.date > to) continue;
    const duty = duties.find((d) => d.id === r.dutyId);
    if (!duty) continue;
    if (stage !== "all" && duty.stage !== stage) continue;
    const person = users.find((u) => u.id === duty.userId);
    if (!person) continue;

    let row = rows.get(person.id);
    if (!row) {
      row = { person, present: 0, late: 0, absent: 0, marked: 0, rate: 0, hours: 0 };
      rows.set(person.id, row);
    }
    row[r.status] += 1;
    row.marked += 1;
    if (r.status !== "absent") row.hours += dutyHours(duty);
  }

  const list = [...rows.values()];
  list.forEach((row) => {
    row.rate = Math.round((row.present / row.marked) * 100);
  });
  return list.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
}