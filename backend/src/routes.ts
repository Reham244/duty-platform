import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import * as s from "./services.js";
import { canTouchStage, currentUser, loadUser, requireRole, scopeStage } from "./auth.js";
import type { AttendanceStatus, NewDuty, Role, StageName } from "./types.js";

export const router = Router();

const staffRoles: Role[] = ["supervisor", "head_of_stage", "admin"];
const statuses: string[] = ["present", "late", "absent"];

// Lets a handler be async, and sends any error to the error handler in index.ts.
type Handler = (req: Request, res: Response) => Promise<void> | void;
const h =
  (fn: Handler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

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
router.get("/users", h(async (_req, res) => {
  res.json(await s.getUsers());
}));

// ---------- Everything below needs the x-user-id header ----------
router.use(loadUser);

// Lists
router.get("/stages", h(async (_req, res) => {
  res.json(await s.getStages());
}));
router.get("/duty-types", h(async (_req, res) => {
  res.json(await s.getDutyTypes());
}));
router.get("/duty-types/counts", h(async (_req, res) => {
  res.json(await s.getDutyTypeCounts());
}));

// Admin only
router.post("/duty-types", requireRole("admin"), h(async (req, res) => {
  const b = bodyOf(req);
  answer(res, await s.addDutyType(text(b.name), text(b.colour) || "#2f8f83", Number(b.weight ?? 1)));
}));
router.put("/users/:id/role", requireRole("admin"), h(async (req, res) => {
  const b = bodyOf(req);
  const homeStage = typeof b.homeStage === "string" && b.homeStage ? (b.homeStage as StageName) : undefined;
  answer(res, await s.setUserRole(Number(req.params.id), text(b.role) as Role, homeStage, currentUser(res).id));
}));

// A person's own duties, attendance and emergencies
router.get("/users/:id/duties", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own duties.");
  res.json(await s.getMyDuties(id));
}));
router.get("/users/:id/attendance", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own attendance.");
  res.json(await s.getMyAttendance(id));
}));
router.get("/users/:id/substitute-duties", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own substitute duties.");
  res.json(await s.getMySubstituteDuties(id));
}));
router.get("/users/:id/emergency", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own reports.");
  res.json({ reported: await s.hasEmergency(id, text(req.query.date)) });
}));
router.post("/emergencies", h(async (req, res) => {
  const b = bodyOf(req);
  const target = Number(b.userId);
  const user = currentUser(res);
  if (target !== user.id && !staffRoles.includes(user.role)) {
    return deny(res, 403, "You can only report your own emergency.");
  }
  await s.reportEmergency(target, text(b.date), text(b.message), user.id);
    res.json({ ok: true });
}));

// Attendance cards and marks (supervisor, head of stage, admin)
router.get("/cards", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getCards(stage, Number(req.query.day), text(req.query.date)));
}));
router.put("/attendance", requireRole(...staffRoles), h(async (req, res) => {
  const b = bodyOf(req);
  const duty = await s.findDuty(Number(b.dutyId));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "This duty is in another stage.");
  if (!statuses.includes(text(b.status))) return deny(res, 400, "Unknown status.");
  await s.markAttendance(duty.id, text(b.date), b.status as AttendanceStatus, currentUser(res).id);
  res.json({ ok: true });
}));
router.put("/substitutions/:id/attendance", requireRole(...staffRoles), h(async (req, res) => {
  const id = Number(req.params.id);
  const stage = await s.getSubstitutionStage(id);
  if (!stage) return deny(res, 404, "Substitution not found.");
  if (!canTouchStage(currentUser(res), stage)) return deny(res, 403, "This duty is in another stage.");
  const status = text(bodyOf(req).status);
  if (!statuses.includes(status)) return deny(res, 400, "Unknown status.");
  await s.markSubstituteAttendance(id, status as AttendanceStatus);
  res.json({ ok: true });
}));

// Substitutions
router.get("/needs-substitute", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getNeedsSubstitute(text(req.query.date), stage));
}));
router.get("/duties/:id/available-substitutes", requireRole(...staffRoles), h(async (req, res) => {
  res.json(await s.getAvailableSubstitutes(Number(req.params.id), text(req.query.date)));
}));
router.post("/substitutions", requireRole(...staffRoles), h(async (req, res) => {
  const b = bodyOf(req);
  const duty = await s.findDuty(Number(b.dutyId));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "This duty is in another stage.");
  answer(
    res,
    await s.addSubstitution(duty.id, text(b.date), Number(b.substituteId), text(b.reason), currentUser(res).id),
  );
}));
router.get("/substitutions", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getSubstitutionsOn(text(req.query.date), stage));
}));

// Statistics
router.get("/stats", requireRole("head_of_stage", "admin", "hr"), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getStats(stage, text(req.query.from), text(req.query.to)));
}));

// Manage schedule
router.get("/schedule", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getStageDuties(stage));
}));
router.get("/users/:id/substitution-summary", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own counts.");
  res.json(await s.getMySubstitutionSummary(id));
}));
router.post("/duties", requireRole(...staffRoles), h(async (req, res) => {
  const n = bodyOf(req) as unknown as NewDuty;
  if (!canTouchStage(currentUser(res), n.stage)) return deny(res, 403, "You can only change your own stage.");
  answer(res, await s.addDuty(n));
}));
router.delete("/duties/:id", requireRole(...staffRoles), h(async (req, res) => {
  const duty = await s.findDuty(Number(req.params.id));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "You can only change your own stage.");
  answer(res, await s.deleteDuty(duty.id));
}));

// Statistics: data completeness
router.get("/stats/coverage", requireRole("head_of_stage", "admin", "hr"), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getStatsCoverage(stage, text(req.query.from), text(req.query.to)));
}));

// Notifications: everyone sees their own
router.get("/notifications", h(async (_req, res) => {
  res.json(await s.getNotifications(currentUser(res).id));
}));
router.get("/notifications/unread-count", h(async (_req, res) => {
  res.json({ count: await s.countUnread(currentUser(res).id) });
}));
router.put("/notifications/read-all", h(async (_req, res) => {
  await s.markAllRead(currentUser(res).id);
  res.json({ ok: true });
}));
router.put("/notifications/:id/read", h(async (req, res) => {
  await s.markNotificationRead(Number(req.params.id), currentUser(res).id);
  res.json({ ok: true });
}));

// Supervisors, heads of stage and admins can notify the teachers on duty.
router.post("/notifications/duties", requireRole(...staffRoles), h(async (req, res) => {
  const b = bodyOf(req);
  const ids = Array.isArray(b.dutyIds) ? b.dutyIds.map(Number).filter((n) => Number.isInteger(n)) : [];
  const user = currentUser(res);
  // A head of stage can only notify duties in their own stage.
  const allowed: number[] = [];
  for (const id of ids) {
    const duty = await s.findDuty(id);
    if (duty && canTouchStage(user, duty.stage)) allowed.push(id);
  }
  res.json({ sent: await s.notifyDuties(allowed, text(b.date), user.id) });
}));

// Demo tool: run the reminder check as if it were the given date and time.
router.post("/reminders/run", requireRole("admin"), h(async (req, res) => {
  const b = bodyOf(req);
  const date = text(b.date);
  const [hh = "", mm = ""] = text(b.time).split(":");
  const nowMinutes = Number(hh) * 60 + Number(mm);
  if (!date || hh === "" || !Number.isFinite(nowMinutes)) return deny(res, 400, "Choose a date and a time.");
  if (b.reset === true) await s.clearReminderLog(date);
  res.json({ sent: await s.runReminders(date, nowMinutes, 10) });
}));
