import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import * as s from "./services.js";
import { canTouchStage, currentUser, loadUser, requireRole, scopeStage } from "./auth.js";
import type { AttendanceStatus, NewDuty, Role, StageName } from "./types.js";
import { getSystemLog } from "./systemLog.js";

export const router = Router();

const staffRoles: Role[] = ["supervisor", "head_of_stage", "admin"];
const statuses: string[] = ["present", "late", "absent"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

// Writes one line in the activity log. A failure here must never break the request.
function audit(res: Response, action: string, summary: string, details?: unknown): void {
  s.logActivity(currentUser(res).id, action, summary, details).catch((e: Error) =>
    console.error("Could not write the activity log:", e.message),
  );
}

// Turns a "message or null" result from the services into an HTTP answer.
function answer(res: Response, error: string | null): void {
  if (error) res.status(400).json({ error });
  else res.json({ ok: true });
}

// A refusal. A 403 is also written to the activity log.
function deny(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
  if (status === 403) {
    s.logActivity(
      currentUser(res).id,
      "access.denied",
      `Tried ${res.req.method} ${res.req.originalUrl}: ${error}`,
      undefined,
      "denied",
    ).catch((e: Error) => console.error("Could not write the activity log:", e.message));
  }
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
// ---------- For the HR portal: may this teacher take leave? It uses an API key, not a person. ----------
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = process.env.INTEGRATION_KEY ?? "";
  if (!key || req.header("x-api-key") !== key) {
    res.status(401).json({ error: "Missing or wrong API key." });
    return;
  }
  next();
}
router.get("/integration/leave-check", requireApiKey, h(async (req, res) => {
  const employee = Number(req.query.employee);
  const date = text(req.query.date);
  const from = text(req.query.from) || "00:00";
  const to = text(req.query.to) || "23:59";
  const need = text(req.query.require) === "covered" ? "covered" : "requested";
  if (!Number.isInteger(employee) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return deny(res, 400, "Send employee and date (YYYY-MM-DD).");
  }
  const result = await s.getLeaveCheck(employee, date, from, to, need);
  if (!result) return deny(res, 404, "Employee not found.");
  res.json(result);
}));
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
  const error = await s.addDutyType(text(b.name), text(b.colour) || "#2f8f83", Number(b.weight ?? 1));
  if (!error) {
    audit(res, "dutytype.add", `Added the duty type "${text(b.name).trim()}"`, {
      name: text(b.name), colour: text(b.colour), weight: b.weight,
    });
  }
  answer(res, error);
}));
router.put("/users/:id/role", requireRole("admin"), h(async (req, res) => {
  const b = bodyOf(req);
  const id = Number(req.params.id);
  const homeStage = typeof b.homeStage === "string" && b.homeStage ? (b.homeStage as StageName) : undefined;
  const role = text(b.role) as Role;
  const before = await s.findUser(id);
  const error = await s.setUserRole(id, role, homeStage, currentUser(res).id);
  if (!error) {
    audit(
      res,
      "role.change",
      `Changed the role of ${before?.fullName ?? `user ${id}`} from ${before?.role ?? "?"} to ${role}${homeStage ? ` (${homeStage})` : ""}`,
      { userId: id, from: before?.role, to: role, stage: homeStage },
    );
  }
  answer(res, error);
}));

// A person's own duties, attendance and substitution requests
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
router.get("/users/:id/substitution-summary", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own counts.");
  res.json(await s.getMySubstitutionSummary(id));
}));
// Substitution requests: one duty on one date
router.get("/users/:id/requests", h(async (req, res) => {
  const id = Number(req.params.id);
  if (!mayView(res, id)) return deny(res, 403, "You can only see your own requests.");
  res.json(await s.getMyRequests(id));
}));
router.post("/requests", h(async (req, res) => {
  const b = bodyOf(req);
  const user = currentUser(res);
  const date = text(b.date);
  let ids = Array.isArray(b.dutyIds) ? b.dutyIds.map(Number).filter((n) => Number.isInteger(n)) : [];
  // allDay: every duty of a teacher on that day (used by the supervisor's request box).
  if (ids.length === 0 && b.allDay === true) {
    const target = Number(b.userId ?? user.id);
    ids = (await s.getMyDuties(target)).filter((d) => d.day === s.weekdayOf(date)).map((d) => d.id);
    if (ids.length === 0) return deny(res, 400, "This teacher has no duty on that day.");
  }
  // A teacher can only request for their own duties. Staff can request for a teacher in their reach.
  for (const id of ids) {
    const duty = await s.findDuty(id);
    if (!duty) return deny(res, 404, "Duty not found.");
    if (duty.userId !== user.id) {
      if (!staffRoles.includes(user.role)) return deny(res, 403, "You can only request a substitution for your own duties.");
      if (!canTouchStage(user, duty.stage)) return deny(res, 403, "This duty is in another stage.");
    }
  }
  const error = await s.requestSubstitution(ids, date, text(b.reason), user.id);
  if (!error) {
    const first = await s.findDuty(ids[0] ?? 0);
    const teacher = first ? await s.findUser(first.userId) : undefined;
    audit(res, "substitution.request", `Substitution requested for ${teacher?.fullName ?? "a teacher"} on ${date} (${ids.length} ${ids.length === 1 ? "duty" : "duties"})`, {
      dutyIds: ids, date,
    });
  }
  answer(res, error);
}));
router.delete("/requests/:id", h(async (req, res) => {
  const user = currentUser(res);
  const id = Number(req.params.id);
  const error = await s.cancelRequest(id, user.id, staffRoles.includes(user.role));
  if (!error) audit(res, "substitution.cancel", `Cancelled substitution request #${id}`, { requestId: id });
  answer(res, error);
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
  const person = await s.findUser(duty.userId);
  audit(
    res,
    "attendance.mark",
    `Marked ${person?.fullName ?? `user ${duty.userId}`} ${text(b.status)} for ${duty.type} at ${duty.place} (${duty.stage}) on ${text(b.date)}`,
    { dutyId: duty.id, date: text(b.date), status: text(b.status) },
  );
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
  audit(res, "attendance.mark", `Marked the substitute on substitution #${id} ${status} (${stage})`, { substitutionId: id, status });
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
  const error = await s.addSubstitution(duty.id, text(b.date), Number(b.substituteId), text(b.reason), currentUser(res).id);
  if (!error) {
    const original = await s.findUser(duty.userId);
    const cover = await s.findUser(Number(b.substituteId));
    audit(
      res,
      "substitution.add",
      `Added ${cover?.fullName ?? "a teacher"} as substitute for ${original?.fullName ?? "a teacher"} (${duty.type} at ${duty.place}, ${duty.stage}) on ${text(b.date)}`,
      { dutyId: duty.id, date: text(b.date), substituteId: Number(b.substituteId) },
    );
  }
  answer(res, error);
}));
router.get("/substitutions", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getSubstitutionsOn(text(req.query.date), stage));
}));

// Statistics
router.get("/stats", requireRole("head_of_stage", "admin", "hr"), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  audit(res, "stats.view", `Viewed statistics for ${stage === "all" ? "all stages" : stage}, ${text(req.query.from)} to ${text(req.query.to)}`, {
    stage, from: text(req.query.from), to: text(req.query.to),
  });
  res.json(await s.getStats(stage, text(req.query.from), text(req.query.to)));
}));
router.get("/stats/coverage", requireRole("head_of_stage", "admin", "hr"), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getStatsCoverage(stage, text(req.query.from), text(req.query.to)));
}));

// Manage schedule
router.get("/schedule", requireRole(...staffRoles), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  res.json(await s.getStageDuties(stage));
}));
router.post("/duties", requireRole(...staffRoles), h(async (req, res) => {
  const n = bodyOf(req) as unknown as NewDuty;
  if (!canTouchStage(currentUser(res), n.stage)) return deny(res, 403, "You can only change your own stage.");
  const error = await s.addDuty(n);
  if (!error) {
    const teacher = await s.findUser(n.userId);
    audit(
      res,
      "duty.add",
      `Added a ${n.type} duty for ${teacher?.fullName ?? `user ${n.userId}`} at ${n.place} (${n.stage}), ${dayNames[n.day] ?? n.day}, ${n.start} to ${n.end}`,
      n,
    );
  }
  answer(res, error);
}));
router.delete("/duties/:id", requireRole(...staffRoles), h(async (req, res) => {
  const duty = await s.findDuty(Number(req.params.id));
  if (!duty) return deny(res, 404, "Duty not found.");
  if (!canTouchStage(currentUser(res), duty.stage)) return deny(res, 403, "You can only change your own stage.");
  const error = await s.deleteDuty(duty.id);
  if (!error) {
    const teacher = await s.findUser(duty.userId);
    audit(
      res,
      "duty.delete",
      `Removed the ${duty.type} duty of ${teacher?.fullName ?? `user ${duty.userId}`} at ${duty.place} (${duty.stage}), ${dayNames[duty.day] ?? duty.day}, ${duty.start} to ${duty.end}`,
      duty,
    );
  }
  answer(res, error);
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
  const sent = await s.notifyDuties(allowed, text(b.date), user.id);
  audit(res, "notify.send", `Sent duty notifications to ${sent} teacher${sent === 1 ? "" : "s"} for ${text(b.date)}`, {
    date: text(b.date), sent,
  });
  res.json({ sent });
}));

// Demo tool: run the reminder check as if it were the given date and time.
router.post("/reminders/run", requireRole("admin"), h(async (req, res) => {
  const b = bodyOf(req);
  const date = text(b.date);
  const [hh = "", mm = ""] = text(b.time).split(":");
  const nowMinutes = Number(hh) * 60 + Number(mm);
  if (!date || hh === "" || !Number.isFinite(nowMinutes)) return deny(res, 400, "Choose a date and a time.");
  if (b.reset === true) await s.clearReminderLog(date);
  const sent = await s.runReminders(date, nowMinutes, 10);
  audit(res, "reminders.run", `Ran the reminder check for ${date} at ${text(b.time)}: ${sent} sent`, { date, time: text(b.time), sent });
  res.json({ sent });
}));

// The activity log: admins only.
router.get("/audit", requireRole("admin"), h(async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
  res.json(
    await s.getAuditLog({
      from: text(req.query.from) || "1970-01-01",
      to: text(req.query.to) || "2999-12-31",
      actor: text(req.query.actor),
      action: text(req.query.action),
      q: text(req.query.q),
      limit,
    }),
  );
}));

// The system log: admins only.
router.get("/logs/system", requireRole("admin"), h(async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 300)));
  res.json(
    await getSystemLog({
      from: text(req.query.from) || "1970-01-01",
      to: text(req.query.to) || "2999-12-31",
      level: text(req.query.level),
      source: text(req.query.source),
      method: text(req.query.method),
      user: text(req.query.user),
      q: text(req.query.q),
      limit,
    }),
  );
}));

// The records behind the statistics, for the detail pages.
router.get("/stats/records", requireRole("head_of_stage", "admin", "hr"), h(async (req, res) => {
  const stage = scopeStage(currentUser(res), stageOf(req.query.stage));
  audit(res, "stats.view", `Opened statistics details for ${stage === "all" ? "all stages" : stage}, ${text(req.query.from)} to ${text(req.query.to)}`, {
    stage, from: text(req.query.from), to: text(req.query.to),
  });
  res.json(await s.getStatRecords(stage, text(req.query.from), text(req.query.to)));
}));

// The normal number of duties per week
router.get("/settings/normal-duties", requireRole("head_of_stage", "admin", "hr"), h(async (_req, res) => {
  res.json(await s.getNormalDuties());
}));
router.put("/settings/normal-duties", requireRole("admin"), h(async (req, res) => {
  const value = Number(bodyOf(req).value);
  const error = await s.setNormalDefault(value);
  if (!error) audit(res, "settings.change", `Set the normal duties per week to ${value}`, { value });
  answer(res, error);
}));
router.put("/users/:id/target", requireRole("admin"), h(async (req, res) => {
  const raw = bodyOf(req).value;
  const value = raw === null || raw === "" || raw === undefined ? null : Number(raw);
  const id = Number(req.params.id);
  const person = await s.findUser(id);
  const error = await s.setUserTarget(id, value);
  if (!error) {
    audit(res, "settings.change", `Set the normal duties per week of ${person?.fullName ?? `user ${id}`} to ${value === null ? "the school default" : value}`, {
      userId: id, value,
    });
  }
  answer(res, error);
}));