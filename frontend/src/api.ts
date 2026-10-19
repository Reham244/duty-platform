import type {
  AttendanceRow, AttendanceStatus, Candidate, Card, Duty, DutyTypeInfo, NeedRow, NewDuty,
  StageName, StatsRow, SubRow, SubstituteDuty, SubstitutionSummary, User, AppNotification, Coverage,
} from "./types";

// The screens keep importing these shapes from here.
export type { AttendanceRow, Candidate, Card, NeedRow, NewDuty, StatsRow, SubRow, SubstituteDuty } from "./types";

const BASE = "http://localhost:3000";

// Who is signed in. The server checks this on every request.
let currentUserId = 0;
export function setCurrentUser(id: number): void {
  currentUserId = id;
}

// ---------- Loading and error notices (shown by App) ----------
let onError: (message: string) => void = () => undefined;
let onBusy: (busy: boolean) => void = () => undefined;
let pending = 0;

export function setNotifiers(error: (message: string) => void, busy: (busy: boolean) => void): void {
  onError = error;
  onBusy = busy;
}

async function request<T>(path: string, options: RequestInit = {}, quiet = false): Promise<T> {
  pending += 1;
  onBusy(true);
  try {
    const res = await fetch(BASE + path, {
      ...options,
      headers: { "Content-Type": "application/json", "x-user-id": String(currentUserId) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "The request failed.");
    return data as T;
  } catch (e) {
    const message =
      e instanceof TypeError
        ? "Cannot reach the backend. Check that it is running."
        : e instanceof Error
          ? e.message
          : "Something went wrong.";
    if (!quiet) onError(message);
    throw new Error(message, { cause: e });
  } finally {
    pending -= 1;
    if (pending === 0) onBusy(false);
  }
}

// For actions where the screens expect "an error message, or null when it worked".
export async function attempt(path: string, options: RequestInit): Promise<string | null> {
  try {
    await request(path, options, true);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Something went wrong.";
  }
}

export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

// ---------- Dates (demo) ----------
export const demoWeekStart = "2026-10-04"; // a Sunday

export function dateOfDay(day: number): string {
  const d = new Date(demoWeekStart + "T12:00:00");
  d.setDate(d.getDate() + day);
  return d.toISOString().slice(0, 10);
}

// ---------- Lists ----------
export const getUsers = () => request<User[]>("/users");
export const getStages = () => request<StageName[]>("/stages");
export const getDutyTypes = () => request<DutyTypeInfo[]>("/duty-types");

// ---------- A person's own data ----------
export const getMyDuties = (userId: number) => request<Duty[]>(`/users/${userId}/duties`);
export const getMyAttendance = (userId: number) => request<AttendanceRow[]>(`/users/${userId}/attendance`);
export const getMySubstituteDuties = (userId: number) =>
  request<SubstituteDuty[]>(`/users/${userId}/substitute-duties`);

export async function hasEmergency(userId: number, date: string): Promise<boolean> {
  const r = await request<{ reported: boolean }>(`/users/${userId}/emergency?` + query({ date }));
  return r.reported;
}

export async function reportEmergency(userId: number, date: string, message: string): Promise<void> {
  await request("/emergencies", json("POST", { userId, date, message }));
}

// ---------- Attendance cards ----------
export const getCards = (stage: StageName | "all", day: number, date: string) =>
  request<Card[]>("/cards?" + query({ stage, day: String(day), date }));

export async function markAttendance(dutyId: number, date: string, status: AttendanceStatus): Promise<void> {
  await request("/attendance", json("PUT", { dutyId, date, status }));
}

export async function markSubstituteAttendance(substitutionId: number, status: AttendanceStatus): Promise<void> {
  await request(`/substitutions/${substitutionId}/attendance`, json("PUT", { status }));
}

// ---------- Substitutions ----------
export const getNeedsSubstitute = (date: string, stage: StageName | "all") =>
  request<NeedRow[]>("/needs-substitute?" + query({ date, stage }));

export const getAvailableSubstitutes = (duty: Duty, date: string) =>
  request<Candidate[]>(`/duties/${duty.id}/available-substitutes?` + query({ date }));

export const addSubstitution = (dutyId: number, date: string, substituteId: number, reason: string) =>
  attempt("/substitutions", json("POST", { dutyId, date, substituteId, reason }));

export const getSubstitutionsOn = (date: string, stage: StageName | "all") =>
  request<SubRow[]>("/substitutions?" + query({ date, stage }));

// ---------- Statistics ----------
export const getStats = (stage: StageName | "all", from: string, to: string) =>
  request<StatsRow[]>("/stats?" + query({ stage, from, to }));

// ---------- Manage schedule ----------
export const getStageDuties = (stage: StageName | "all") =>
  request<Duty[]>("/schedule?" + query({ stage }));

export const addDuty = (n: NewDuty) => attempt("/duties", json("POST", n));

export const deleteDuty = (id: number) => attempt(`/duties/${id}`, { method: "DELETE" });

// ---------- Duty types ----------
export const getDutyTypeCounts = () => request<Record<string, number>>("/duty-types/counts");

export const addDutyType = (name: string, colour: string, weight: number) =>
  attempt("/duty-types", json("POST", { name, colour, weight }));
export const getMySubstitutionSummary = (userId: number) =>
  request<SubstitutionSummary>(`/users/${userId}/substitution-summary`);

// ---------- Statistics: data completeness ----------
export const getStatsCoverage = (stage: StageName | "all", from: string, to: string) =>
  request<Coverage>("/stats/coverage?" + query({ stage, from, to }));

// ---------- Notifications ----------
export const getNotifications = () => request<AppNotification[]>("/notifications");

export async function getUnreadCount(): Promise<number> {
  const r = await request<{ count: number }>("/notifications/unread-count");
  return r.count;
}

export async function markNotificationRead(id: number): Promise<void> {
  await request(`/notifications/${id}/read`, json("PUT", {}));
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/notifications/read-all", json("PUT", {}));
}

// Returns how many notifications were sent.
export async function notifyDuties(dutyIds: number[], date: string): Promise<number> {
  const r = await request<{ sent: number }>("/notifications/duties", json("POST", { dutyIds, date }));
  return r.sent;
}