import { attempt, json } from "./api";
import type { Role, StageName } from "./types";

// Returns an error message, or null when the role was saved.
export function setUserRole(userId: number, role: Role, homeStage: StageName | undefined) {
  return attempt(`/users/${userId}/role`, json("PUT", { role, homeStage }));
}