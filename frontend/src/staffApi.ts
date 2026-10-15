import { users } from "./data/dummyData";
import type { Role, StageName } from "./types";

// Returns an error message, or null when the role was saved.
export async function setUserRole(
  userId: number,
  role: Role,
  homeStage: StageName | undefined,
  actingUserId: number,
): Promise<string | null> {
  const person = users.find((u) => u.id === userId);
  if (!person) return "Person not found.";
  if (userId === actingUserId && role !== "admin") {
    return "You cannot remove your own admin role.";
  }
  if (role === "head_of_stage" && !homeStage) {
    return "Choose the stage this head of stage is responsible for.";
  }
  person.role = role;
  person.homeStage = homeStage;
  return null;
}