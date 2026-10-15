import { Router } from "express";
import type { Request, Response } from "express";
import * as s from "./services.js";
import { canTouchStage, currentUser, loadUser, requireRole, scopeStage } from "./auth.js";
import type { AttendanceStatus, NewDuty, Role, StageName } from "./types.js";

export const router = Router();

const staffRoles: Role[] = ["supervisor", "head_of_stage", "admin"];
const statuses: string[] = ["present", "late", "absent"];

const bodyOf = (req: Request) => (req.body ?? {}) as Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const stageOf = (value: unknown): StageName | "all" =>
  typeof value === "string" && value ? (value as StageName | "all") : "all";

// Turns a "message or null" result from the services into an HTTP answer.
function answer(res: Response, error: string | null): void {
  if (error) res.status(400).json({ error });
  else res.json({ ok: true });
}

function deny(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

// A person can see their own data. Every role except teacher can see anyone's.
function mayView(res: Response, targetId: number): boolean {
  const user = currentUser(res);
  return user.id === targetId || user.role !== "teacher";
}

// ---------- Open to everyone: the demo "who are you" list ----------
router.get("/users", (_req, res) => {
  res.json(s.getUsers());
});

// ---------- Everything below needs the x-user-id header ----------
router.use(loadUser);

// Lists
router.get("/stages", (_req, res) => {
  res.json(s.getStages());
});
router.get("/duty-types", (_req, res) => {
  res.json(s.getDutyTypes());
});
router.get("/duty-types/counts", (_req, res) => {
  res.json(s.getDutyTypeCounts());
});

// Admin only
router.post("/duty-types", requireRole("admin"), (req, res) => {
  const b = bodyOf(req);
  answer(res, s.addDutyType(text(b.name), text(b.colour) || "#2f8f83", Number(b.weight ?? 1)));
});
router.put("/users/:id/role", requireRole("admin"), (req, res) => {
  const b = bodyOf(req);
  const homeStage = typeof b.homeStage === "string" ? (b.homeStage as StageName) : undefined;
  answer(res, s.setUserRole(Number(req.params.id), text(b.role) as Role, homeStage, currentUser(res).id));
});

// A person's own duties, attendance and emergencies
router.get("/users/:id/duties", (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own duties.");
  res.json(s.getMyDuties(id));
});
router.get("/users/:id/attendance", (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own attendance.");
  res.json(s.getMyAttendance(id));
});
router.get("/users/:id/substitute-duties", (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own substitute duties.");
  res.json(s.getMySubstituteDuties(id));
});
router.get("/users/:id/emergency", (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own reports.");
  res.json({ reported: s.hasEmergency(id, text(req.query.date)) });
});
router.post("/emergencies", (req, res) => {
  const b = bodyOf(req);
  const target = Number(b.userId);
  const user = currentUser(res);
  if (target !== user.id && !staffRoles.includes(user.role)) {
    return deny(res, 403, "You can only report your own emergency.");
  }
  s.reportEmergency(target, text(b.date), text(b.message));
  res.json({ ok: true });
});

// Attendance cards and marks (supervisor, head of stage, admin)
router.get("/cards", requireRole(...staffRoles), (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(s.getCards(stage, Number(req.query.day), text(req.query.date)));
});
router.put("/attendance", requireRole(...staffRoles), (req, res) => {
  const b = bodyOf(req);
  const duty = s.findDuty(Number(b.dutyId));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "This duty is in another stage.");
  if (!statuses.includes(text(b.status))) return deny(res, 400, "Unknown status.");
  s.markAttendance(duty.id, text(b.date), b.status as AttendanceStatus);
  res.json({ ok: true });
});
router.put("/substitutions/:id/attendance", requireRole(...staffRoles), (req, res) => {
  const id = Number(req.params.id);
  const stage = s.getSubstitutionStage(id);
  if (!stage) return deny(res, 404, "Substitution not found.");
  if (!canTouchStage(currentUser(res), stage)) return deny(res, 403, "This duty is in another stage.");
  const status = text(bodyOf(req).status);
  if (!statuses.includes(status)) return deny(res, 400, "Unknown status.");
  s.markSubstituteAttendance(id, status as AttendanceStatus);
  res.json({ ok: true });
});

// Substitutions
router.get("/needs-substitute", requireRole(...staffRoles), (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(s.getNeedsSubstitute(text(req.query.date), stage));
});
router.get("/duties/:id/available-substitutes", requireRole(...staffRoles), (req, res) => {
  res.json(s.getAvailableSubstitutes(Number(req.params.id), text(req.query.date)));
});
router.post("/substitutions", requireRole(...staffRoles), (req, res) => {
  const b = bodyOf(req);
  const duty = s.findDuty(Number(b.dutyId));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "This duty is in another stage.");
  answer(res, s.addSubstitution(duty.id, text(b.date), Number(b.substituteId), text(b.reason)));
});
router.get("/substitutions", requireRole(...staffRoles), (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(s.getSubstitutionsOn(text(req.query.date), stage));
});

// Statistics
router.get("/stats", requireRole("head_of_stage", "admin", "hr"), (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(s.getStats(stage, text(req.query.from), text(req.query.to)));
});

// Manage schedule
router.get("/schedule", requireRole(...staffRoles), (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(s.getStageDuties(stage));
});
router.post("/duties", requireRole(...staffRoles), (req, res) => {
  const n = bodyOf(req) as unknown as NewDuty;
  if (!canTouchStage(currentUser(res), n.stage)) return deny(res, 403, "You can only change your own stage.");
  answer(res, s.addDuty(n));
});
router.delete("/duties/:id", requireRole(...staffRoles), (req, res) => {
  const duty = s.findDuty(Number(req.params.id));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "You can only change your own stage.");
  answer(res, s.deleteDuty(duty.id));
});