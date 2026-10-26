import type { Role } from "./types";

export type ScreenId =
  | "myDuties"
  | "attendance"
  | "substitutions"
  | "schedule"
  | "stats"
  | "allStats"
  | "dutyTypes"
  | "users"
  | "sessions"
  | "notifications";

export const screens: Record<ScreenId, { title: string; about: string; ready: boolean }> = {
  myDuties: { title: "My duties", about: "Your weekly duties and your own attendance.", ready: true },
  attendance: { title: "Attendance cards", about: "Mark Present, Late or Absent for each duty.", ready: true },
  substitutions: { title: "Substitutions", about: "See substitution requests and add a substitute for a duty.", ready: true },
  schedule: { title: "Manage schedule", about: "Add and remove duties, and assign teachers, for each stage.", ready: true },
  stats: { title: "Stage statistics", about: "Attendance, workload and substitutions for the teachers in your stage.", ready: true },
  allStats: { title: "All stages statistics", about: "Attendance, workload and substitutions for every stage.", ready: true },
  dutyTypes: { title: "Duty types", about: "Add the kinds of duty (snack, break, dismissal, after-school program, and so on).", ready: true },
  users: { title: "Staff and roles", about: "Pick a person and assign their role.", ready: true },
  sessions: { title: "Session attendance", about: "See the schedule of your classes and mark each teacher's session with one click. The schedule comes from the LMS.", ready: false },
  notifications: { title: "Notifications", about: "Reminders about your duties and substitutions.", ready: true },
};

export const roleLabels: Record<Role, string> = {
  teacher: "Teacher",
  supervisor: "Supervisor",
  head_of_stage: "Head of stage",
  admin: "Admin",
  matron: "Matron",
  hr: "HR",
};

// Which screens each role can open. The first one opens by default.
export const menuByRole: Record<Role, ScreenId[]> = {
  teacher: ["myDuties", "notifications"],
  supervisor: ["attendance", "substitutions", "schedule", "notifications"],
  head_of_stage: ["attendance", "substitutions", "schedule", "stats", "notifications"],
  admin: ["attendance", "substitutions", "schedule", "allStats", "dutyTypes", "users", "notifications"],
  matron: ["sessions", "notifications"],
  hr: ["allStats", "notifications"],
};