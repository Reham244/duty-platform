import { users } from "./data/dummyData";
import type { User } from "./types";

export async function getUsers(): Promise<User[]> {
  return users;
}