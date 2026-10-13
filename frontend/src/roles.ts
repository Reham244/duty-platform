import type { Role } from "./types";

export type ScreenId =
  | "myDuties"
  | "attendance"
  | "substitutions"
  | "schedule"
  | "stats"
  | "allStats"
  | "dutyTypes"
  | "users";

export const screens: Record<ScreenId, { title: string; about: string; ready: boolean }> = {
  myDuties: { title: "My duties", about: "Your weekly duties and your own attendance.", ready: true },
  attendance: { title: "Attendance cards", about: "Mark Present, Late or Absent for each duty.", ready: true },
  substitutions: { title: "Substitutions", about: "See emergency reports and add a substitute for a duty.", ready: true },
  schedule: { title: "Manage schedule", about: "Add and edit duties, and assign teachers, for each stage.", ready: true },
  stats: { title: "Stage statistics", about: "Attended, late and missed duties per teacher in your stage.", ready: true },
  allStats: { title: "All stages statistics", about: "Attendance and workload for every stage.", ready: true },
  dutyTypes: { title: "Duty types", about: "Add and edit the kinds of duty (snack, break, dismissal, after-school program, and so on).", ready: true },
  users: { title: "Staff", about: "Manage the people and their roles.", ready: false },
};

// Which screens each role can open. The first one opens by default.
export const menuByRole: Record<Role, ScreenId[]> = {
  teacher: ["myDuties"],
  supervisor: ["attendance", "substitutions", "schedule"],
  head_of_stage: ["attendance" ,"substitutions","schedule","stats"],
  admin: ["attendance", "substitutions", "schedule", "allStats", "dutyTypes", "users"],
};