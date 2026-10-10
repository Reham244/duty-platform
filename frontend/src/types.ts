export type Role = "teacher" | "supervisor" | "head_of_stage" | "admin";
export type StageName = "Foundation" | "Elementary" | "Middle" | "High";

export interface User {
  id: number;
  fullName: string;
  role: Role;
  homeStage?: StageName;
  subject?: string;
} 