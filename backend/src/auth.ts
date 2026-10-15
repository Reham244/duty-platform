import type { NextFunction, Request, Response } from "express";
import { findUser } from "./services.js";
import type { Role, StageName, User } from "./types.js";

// Reads the x-user-id header and finds the person. Real sign-in replaces this later.
export function loadUser(req: Request, res: Response, next: NextFunction): void {
  const id = Number(req.header("x-user-id"));
  const user = Number.isFinite(id) ? findUser(id) : undefined;
  if (!user) {
    res.status(401).json({ error: "Unknown user. Send the x-user-id header." });
    return;
  }
  res.locals.user = user;
  next();
}

export const currentUser = (res: Response): User => res.locals.user as User;

// Only the listed roles may continue.
export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!roles.includes(currentUser(res).role)) {
      res.status(403).json({ error: "Your role is not allowed to do this." });
      return;
    }
    next();
  };
}

// A head of stage works on their own stage only, whatever stage they ask for.
export function scopeStage(user: User, requested: StageName | "all"): StageName | "all" {
  if (user.role === "head_of_stage") return user.homeStage ?? requested;
  return requested;
}

export function canTouchStage(user: User, stage: StageName): boolean {
  return user.role !== "head_of_stage" || user.homeStage === stage;
}