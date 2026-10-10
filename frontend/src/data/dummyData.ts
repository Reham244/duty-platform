import type { Duty, StageName, User } from "../types";//dummy data for users, stages 
export const stages: StageName[] = ["Foundation", "Elementary", "Middle", "High"];

export const users: User[] = [
  { id: 1, fullName: "Teacher 43", role: "teacher", subject: "French" },
  { id: 2, fullName: "Supervisor 01", role: "supervisor" },
  { id: 3, fullName: "Head of Elementary", role: "head_of_stage", homeStage: "Elementary" },
  { id: 4, fullName: "Admin 01", role: "admin" },
];
//dumy data for duties 
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
];