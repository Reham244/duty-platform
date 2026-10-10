import { duties, users } from "./data/dummyData";
import type { Duty, User } from "./types";

export async function getUsers(): Promise<User[]> {
  return users;
}

export async function getMyDuties(userId: number): Promise<Duty[]> {
  return duties.filter((d) => d.userId === userId);
}