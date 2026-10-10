import type { StageName, User } from "../types";

export const stages: StageName[] = ["Foundation", "Elementary", "Middle", "High"];

export const users: User[] = [
  { id: 1, fullName: "Teacher 43", role: "teacher", subject: "French" },
  { id: 2, fullName: "Supervisor 01", role: "supervisor" },
  { id: 3, fullName: "Head of Elementary", role: "head_of_stage", homeStage: "Elementary" },
  { id: 4, fullName: "Admin 01", role: "admin" },
];