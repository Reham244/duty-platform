//Roles types (teacher, supervisor, head of stage, admin) and stages types (foundation, elementary, middle, high)
export type Role = "teacher" | "supervisor" | "head_of_stage" | "admin";
export type StageName = "Foundation" | "Elementary" | "Middle" | "High";

export interface User {
  id: number;
  fullName: string;
  role: Role;
  homeStage?: StageName;
  subject?: string;
} 
// Duty types (snack, break, dismassal)
export type DutyType = "snack" | "break" | "dismissal";

export interface Duty {
  id: number;
  userId: number;
  stage: StageName;
  type: DutyType;
  place: string;
  day: number; // 0 = Sunday ... 4 = Thursday
  start: string; // "12:00"
  end: string;
}