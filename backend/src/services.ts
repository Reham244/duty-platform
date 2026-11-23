import { query, run } from "./db.js";
import type {
  AttendanceRow, AttendanceStatus, Candidate, Card, CardStatus, Duty, DutyTypeInfo, EmergencyReport,
  NeedRow, NewDuty, Role, StageName, StatsRow, SubRow, SubStatus, Substitution, SubstituteDuty, SubstitutionSummary, User, AppNotification, Coverage, AuditEntry, StatRecord, LeaveCheck, LeaveCheckDuty, NormalDuties, SubstitutionRequest,
} from "./types.js";

type StageFilter = StageName | "all";

export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

function minutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

// ---------- Reusable pieces of SQL ----------
// A "duty" in the app is an assignment (a teacher on a slot) joined with the slot's details.
const DUTY_COLUMNS = `
  a.id AS id, a.user_id AS userId, s.name AS stage, t.code AS type, ar.name AS place,
  sl.day_of_week AS day, TIME_FORMAT(sl.start_time, '%H:%i') AS \`start\`,
  TIME_FORMAT(sl.end_time, '%H:%i') AS \`end\``;

const DUTY_FROM = `
  FROM assignments a
  JOIN duty_slots sl ON sl.id = a.slot_id
  JOIN stages s ON s.id = sl.stage_id
  JOIN duty_types t ON t.id = sl.duty_type_id
  JOIN areas ar ON ar.id = sl.area_id`;

const DUTY_SELECT = `SELECT ${DUTY_COLUMNS} ${DUTY_FROM}`;

const SUB_COLUMNS = `
  sb.id AS sid, sb.duty_date AS \`sdate\`, sb.substitute_user_id AS substituteId,
  sb.reason AS reason, sb.status AS sstatus`;

type SubJoin = Duty & { sid: number; sdate: string; substituteId: number; reason: string | null; sstatus: SubStatus };

function dutyOf(r: Duty): Duty {
  return { id: r.id, userId: r.userId, stage: r.stage, type: r.type, place: r.place, day: r.day, start: r.start, end: r.end };
}

function subOf(r: SubJoin): Substitution {
  return { id: r.sid, dutyId: r.id, date: r.sdate, substituteId: r.substituteId, reason: r.reason ?? "", status: r.sstatus };
}

// ---------- People ----------
interface UserRow {
  id: number;
  fullName: string;
  role: Role;
  homeStage: StageName | null;
  subject: string | null;
}

const USER_SELECT = `
  SELECT u.id AS id, u.full_name AS fullName, u.role AS role, st.name AS homeStage, u.subject AS subject
  FROM users u LEFT JOIN stages st ON st.id = u.stage_id`;

function toUser(r: UserRow): User {
  const u: User = { id: r.id, fullName: r.fullName, role: r.role };
  if (r.homeStage) u.homeStage = r.homeStage;
  if (r.subject) u.subject = r.subject;
  return u;
}

export async function getUsers(): Promise<User[]> {
  return (await query<UserRow>(USER_SELECT + " ORDER BY u.id")).map(toUser);
}

export async function findUser(id: number): Promise<User | undefined> {
  const row = (await query<UserRow>(USER_SELECT + " WHERE u.id = ?", [id]))[0];
  return row ? toUser(row) : undefined;
}

async function userMap(): Promise<Map<number, User>> {
  return new Map((await getUsers()).map((u) => [u.id, u] as const));
}

// ---------- Lists ----------
export async function getStages(): Promise<StageName[]> {
  return (await query<{ name: StageName }>("SELECT name FROM stages ORDER BY id")).map((r) => r.name);
}

export function getDutyTypes(): Promise<DutyTypeInfo[]> {
  return query<DutyTypeInfo>("SELECT code, name, colour, CAST(weight AS DOUBLE) AS weight FROM duty_types ORDER BY id");
}

// ---------- A person's own data ----------
export function getMyDuties(userId: number): Promise<Duty[]> {
  return query<Duty>(DUTY_SELECT + " WHERE a.user_id = ? ORDER BY sl.day_of_week, sl.start_time", [userId]);
}

export async function findDuty(id: number): Promise<Duty | undefined> {
  return (await query<Duty>(DUTY_SELECT + " WHERE a.id = ?", [id]))[0];
}

export async function getMyAttendance(userId: number): Promise<AttendanceRow[]> {
  // Own duties that were marked.
  const own = await query<Duty & { recordId: number; date: string; recordStatus: AttendanceStatus }>(
    `SELECT ${DUTY_COLUMNS}, r.id AS recordId, r.duty_date AS \`date\`, r.status AS recordStatus
     ${DUTY_FROM}
     JOIN attendance_records r ON r.assignment_id = a.id
     WHERE a.user_id = ? AND r.status IN ('present', 'late', 'absent')`,
    [userId],
  );

  // Own duties that someone else covered: the teacher is excused.
  const excused = await query<SubJoin>(
    `SELECT ${DUTY_COLUMNS}, ${SUB_COLUMNS}
     ${DUTY_FROM}
     JOIN substitutions sb ON sb.assignment_id = a.id
     WHERE a.user_id = ?`,
    [userId],
  );

  // Duties this person covered as a substitute (only the ones already marked).
  const covered = await query<SubJoin>(
    `SELECT ${DUTY_COLUMNS}, ${SUB_COLUMNS}
     ${DUTY_FROM}
     JOIN substitutions sb ON sb.assignment_id = a.id
     WHERE sb.substitute_user_id = ? AND sb.status IN ('present', 'late', 'absent')`,
    [userId],
  );

  const rows: AttendanceRow[] = [
    ...own.map((r): AttendanceRow => ({ id: `own-${r.recordId}`, date: r.date, status: r.recordStatus, kind: "own", duty: dutyOf(r) })),
    ...excused.map((r): AttendanceRow => ({ id: `excused-${r.sid}`, date: r.sdate, status: "excused", kind: "excused", duty: dutyOf(r) })),
    ...covered.map((r): AttendanceRow => ({
      id: `substitute-${r.sid}`,
      date: r.sdate,
      status: r.sstatus as AttendanceStatus,
      kind: "substitute",
      duty: dutyOf(r),
    })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.duty.start.localeCompare(b.duty.start));
}
export async function hasEmergency(userId: number, date: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    "SELECT 1 AS n FROM emergency_reports WHERE user_id = ? AND report_date = ? LIMIT 1",
    [userId, date],
  );
  return rows.length > 0;
}
// The teacher's "Request substitution" for a day. It covers all their duties that day.
// ---------- Substitution requests ----------
// A request is for one duty on one date. A teacher asks for a substitute, or a supervisor asks for them.
const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface RequestRow extends Duty {
  rid: number;
  rdate: string;
  rreason: string | null;
  rstatus: "open" | "covered";
  rcreated: string;
  substituteName: string | null;
}

export async function getMyRequests(userId: number): Promise<SubstitutionRequest[]> {
  const rows = await query<RequestRow>(
    `SELECT ${DUTY_COLUMNS}, q.id AS rid, q.duty_date AS \`rdate\`, q.reason AS rreason,
            CASE WHEN sb.id IS NOT NULL THEN 'covered' ELSE q.status END AS rstatus,
            q.created_at AS rcreated, su.full_name AS substituteName
     ${DUTY_FROM}
     JOIN substitution_requests q ON q.assignment_id = a.id
     LEFT JOIN substitutions sb ON sb.assignment_id = a.id AND sb.duty_date = q.duty_date
     LEFT JOIN users su ON su.id = sb.substitute_user_id
     WHERE a.user_id = ? AND q.status <> 'cancelled' AND q.duty_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
     ORDER BY q.duty_date DESC, sl.start_time`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.rid,
    dutyId: r.id,
    date: r.rdate,
    reason: r.rreason ?? "",
    status: r.rstatus,
    createdAt: r.rcreated,
    duty: dutyOf(r),
    substituteName: r.substituteName,
  }));
}

// Returns an error message, or null when the request was saved.
export async function requestSubstitution(dutyIds: number[], date: string, reason: string, actorId: number): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Choose a date.";
  if (date < todayIso()) return "You can only request a substitution for today or a later date.";
  if (dutyIds.length === 0) return "Choose at least one duty.";

  const duties: Duty[] = [];
  for (const id of dutyIds) {
    const duty = await findDuty(id);
    if (!duty) return "Duty not found.";
    if (duty.day !== weekdayOf(date)) return `${date} is not a ${dayLabels[duty.day] ?? "?"}, the day of that duty.`;
    duties.push(duty);
  }
  const teacherId = duties[0]?.userId;
  if (teacherId === undefined || duties.some((d) => d.userId !== teacherId)) return "A request must be for one teacher's duties.";

  let created = 0;
  for (const d of duties) {
    const existing = (await query<{ status: string }>(
      "SELECT status FROM substitution_requests WHERE assignment_id = ? AND duty_date = ?",
      [d.id, date],
    ))[0];
    if (existing && existing.status !== "cancelled") continue; // already requested or covered
    await run(
      `INSERT INTO substitution_requests (assignment_id, duty_date, requested_by, reason, status)
       VALUES (?, ?, ?, ?, 'open')
       ON DUPLICATE KEY UPDATE requested_by = VALUES(requested_by), reason = VALUES(reason), status = 'open', created_at = NOW()`,
      [d.id, date, actorId, reason.slice(0, 250)],
    );
    created += 1;
  }
  if (created === 0) return "These duties already have a request.";

  // Tell the people who arrange substitutes: supervisors, admins, and the head of each stage involved.
  const teacher = await findUser(teacherId);
  const types = await getDutyTypes();
  const what = duties.map((d) => `${types.find((t) => t.code === d.type)?.name ?? d.type} at ${d.place} ${d.start}`).join(", ");
  const stageNames = [...new Set(duties.map((d) => d.stage))];
  const recipients = await query<{ id: number }>(
    `SELECT u.id AS id FROM users u
     WHERE u.role IN ('supervisor', 'admin')
        OR (u.role = 'head_of_stage' AND u.stage_id IN (SELECT id FROM stages WHERE name IN (?)))`,
    [stageNames],
  );
  for (const r of recipients) {
    if (r.id === actorId) continue; // the person who pressed the button already knows
    await createNotification(
      r.id,
      "substitution-request",
      "Substitution requested",
      `${teacher?.fullName ?? "A teacher"} needs a substitute on ${date}: ${what}.`,
      actorId,
    );
  }
  // When a supervisor asked for the teacher, tell the teacher too.
  if (actorId !== teacherId) {
    await createNotification(teacherId, "substitution-request", "A substitution was requested for you", `${date}: ${what}.`, actorId);
  }
  return null;
}

// A teacher can cancel their own open request. Staff can cancel any open request.
export async function cancelRequest(requestId: number, actorId: number, isStaff: boolean): Promise<string | null> {
  const row = (await query<{ assignment_id: number; duty_date: string; user_id: number; status: string }>(
    `SELECT q.assignment_id AS assignment_id, q.duty_date AS \`duty_date\`, a.user_id AS user_id, q.status AS status
     FROM substitution_requests q JOIN assignments a ON a.id = q.assignment_id WHERE q.id = ?`,
    [requestId],
  ))[0];
  if (!row) return "Request not found.";
  if (row.user_id !== actorId && !isStaff) return "You can only cancel your own request.";
  const covered = await query<{ n: number }>(
    "SELECT 1 AS n FROM substitutions WHERE assignment_id = ? AND duty_date = ? LIMIT 1",
    [row.assignment_id, row.duty_date],
  );
  if (covered.length > 0) return "A substitute is already assigned. Ask the supervisor to change it.";
  if (row.status === "cancelled") return null;
  await run("UPDATE substitution_requests SET status = 'cancelled' WHERE id = ?", [requestId]);
  return null;
}
export async function getMySubstituteDuties(userId: number): Promise<SubstituteDuty[]> {
  const rows = await query<SubJoin>(
    `SELECT ${DUTY_COLUMNS}, ${SUB_COLUMNS}
     ${DUTY_FROM}
     JOIN substitutions sb ON sb.assignment_id = a.id
     WHERE sb.substitute_user_id = ?
     ORDER BY sb.duty_date DESC`,
    [userId],
  );
  return rows.map((r) => ({ substitution: subOf(r), duty: dutyOf(r) }));
}

// ---------- Attendance cards ----------
export async function getCards(stage: StageFilter, day: number, date: string): Promise<Card[]> {
  const params: unknown[] = [day];
  let where = " WHERE sl.day_of_week = ?";
  if (stage !== "all") {
    where += " AND s.name = ?";
    params.push(stage);
  }
  const duties = await query<Duty>(DUTY_SELECT + where + " ORDER BY sl.start_time, a.id", params);
  if (duties.length === 0) return [];

  const ids = duties.map((d) => d.id);
  const records = await query<{ assignment_id: number; status: string }>(
    "SELECT assignment_id, status FROM attendance_records WHERE duty_date = ? AND assignment_id IN (?)",
    [date, ids],
  );
  const subs = await query<{ id: number; assignment_id: number; substitute_user_id: number; status: SubStatus }>(
    "SELECT id, assignment_id, substitute_user_id, status FROM substitutions WHERE duty_date = ? AND assignment_id IN (?)",
    [date, ids],
  );
  const requested = await query<{ assignment_id: number }>(
    "SELECT assignment_id FROM substitution_requests WHERE duty_date = ? AND status = 'open' AND assignment_id IN (?)",
    [date, ids],
  );
  const people = await userMap();

  const cards: Card[] = [];
  for (const d of duties) {
    const person = people.get(d.userId);
    if (!person) continue;
    const rec = records.find((r) => r.assignment_id === d.id);
    const sub = subs.find((s) => s.assignment_id === d.id);
    const status: CardStatus = sub
      ? "substituted"
      : rec && (rec.status === "present" || rec.status === "late" || rec.status === "absent")
        ? rec.status
        : "unmarked";
    const card: Card = { duty: d, person, status, emergency: !sub && requested.some((r) => r.assignment_id === d.id) };
    const subPerson = sub ? people.get(sub.substitute_user_id) : undefined;
    if (sub && subPerson) card.substitution = { id: sub.id, person: subPerson, status: sub.status };
    cards.push(card);
  }
  return cards;
}
export async function markAttendance(
  dutyId: number,
  date: string,
  status: AttendanceStatus,
  markedBy: number,
): Promise<void> {
  await run(
    `INSERT INTO attendance_records (assignment_id, duty_date, status, marked_by, marked_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by), marked_at = NOW()`,
    [dutyId, date, status, markedBy],
  );
}

export async function markSubstituteAttendance(substitutionId: number, status: AttendanceStatus): Promise<void> {
  await run("UPDATE substitutions SET status = ? WHERE id = ?", [status, substitutionId]);
}

// ---------- Substitutions ----------
export async function getSubstitutionStage(id: number): Promise<StageName | undefined> {
  const row = (
    await query<{ stage: StageName }>(
      `SELECT s.name AS stage FROM substitutions sb
       JOIN assignments a ON a.id = sb.assignment_id
       JOIN duty_slots sl ON sl.id = a.slot_id
       JOIN stages s ON s.id = sl.stage_id
       WHERE sb.id = ?`,
      [id],
    )
  )[0];
  return row?.stage;
}

export async function getNeedsSubstitute(date: string, stage: StageFilter): Promise<NeedRow[]> {
  const params: unknown[] = [date, date];
  let where =
    " WHERE q.status = 'open' AND NOT EXISTS (SELECT 1 FROM substitutions b WHERE b.assignment_id = a.id AND b.duty_date = ?)";
  if (stage !== "all") {
    where += " AND s.name = ?";
    params.push(stage);
  }
  const rows = await query<Duty & { rid: number; rreason: string | null }>(
    `SELECT ${DUTY_COLUMNS}, q.id AS rid, q.reason AS rreason
     ${DUTY_FROM}
     JOIN substitution_requests q ON q.assignment_id = a.id AND q.duty_date = ?
     ${where}
     ORDER BY sl.start_time`,
    params,
  );
  const people = await userMap();
  const out: NeedRow[] = [];
  for (const r of rows) {
    const person = people.get(r.userId);
    if (!person) continue;
    const report: EmergencyReport = { id: r.rid, userId: r.userId, date, message: r.rreason ?? "", status: "open" };
    out.push({ report, person, duty: dutyOf(r) });
  }
  return out;
}
// Teachers with no duty at that time, no other cover at that time, and no emergency that day.
export async function getAvailableSubstitutes(dutyId: number, date: string): Promise<Candidate[]> {
  const duty = await findDuty(dutyId);
  if (!duty) return [];
  const start = duty.start + ":00";
  const end = duty.end + ":00";
  const rows = await query<UserRow & { cnt: number }>(
    `SELECT u.id AS id, u.full_name AS fullName, u.role AS role, st.name AS homeStage, u.subject AS subject,
            (SELECT COUNT(*) FROM substitutions c WHERE c.substitute_user_id = u.id) AS cnt
     FROM users u LEFT JOIN stages st ON st.id = u.stage_id
     WHERE u.role = 'teacher' AND u.id <> ?
       AND NOT EXISTS (
         SELECT 1 FROM assignments a2 JOIN duty_slots s2 ON s2.id = a2.slot_id
         WHERE a2.user_id = u.id AND s2.day_of_week = ? AND s2.start_time < ? AND ? < s2.end_time)
       AND NOT EXISTS (
         SELECT 1 FROM substitutions b
         JOIN assignments a3 ON a3.id = b.assignment_id JOIN duty_slots s3 ON s3.id = a3.slot_id
         WHERE b.substitute_user_id = u.id AND b.duty_date = ? AND s3.start_time < ? AND ? < s3.end_time)
         AND NOT EXISTS (SELECT 1 FROM substitution_requests rq JOIN assignments ra ON ra.id = rq.assignment_id WHERE ra.user_id = u.id AND rq.duty_date = ? AND rq.status = 'open')     ORDER BY cnt, u.full_name`,
    [duty.userId, weekdayOf(date), end, start, date, end, start, date],
  );
  return rows.map((r) => ({ person: toUser(r), count: Number(r.cnt) }));
}

export async function addSubstitution(
  dutyId: number,
  date: string,
  substituteId: number,
  reason: string,
  addedBy: number,
): Promise<string | null> {
  const duty = await findDuty(dutyId);
  if (!duty) return "Duty not found.";
  const free = await getAvailableSubstitutes(dutyId, date);
  if (!free.some((c) => c.person.id === substituteId)) return "This teacher is not free at that time.";

  // The original teacher is excused, so remove any mark they already had.
  await run("DELETE FROM attendance_records WHERE assignment_id = ? AND duty_date = ?", [dutyId, date]);
  await run(
    `INSERT INTO substitutions (assignment_id, duty_date, substitute_user_id, added_by, reason, status)
     VALUES (?, ?, ?, ?, ?, 'unmarked')
     ON DUPLICATE KEY UPDATE substitute_user_id = VALUES(substitute_user_id), added_by = VALUES(added_by),
                             reason = VALUES(reason), status = 'unmarked'`,
    [dutyId, date, substituteId, addedBy, reason],
  );

  // If the teacher had asked for a substitute for this duty, the request is now covered.
  await run("UPDATE substitution_requests SET status = 'covered' WHERE assignment_id = ? AND duty_date = ? AND status = 'open'", [
    dutyId, date,
  ]);

  // Tell both teachers.
  const types = await getDutyTypes();
  const typeName = types.find((t) => t.code === duty.type)?.name ?? duty.type;
  const what = `${typeName} at ${duty.place} (${duty.stage}), ${duty.start} to ${duty.end}, ${date}`;
  const cover = await findUser(substituteId);
  const original = await findUser(duty.userId);
  await createNotification(
    substituteId,
    "substitution",
    "You were asked to substitute",
    `${what}. You are covering for ${original?.fullName ?? "a colleague"}.`,
    addedBy,
  );
  await createNotification(
    duty.userId,
    "excused",
    "Your duty is covered",
    `${what}. ${cover?.fullName ?? "A colleague"} will cover it, and you are excused.`,
    addedBy,
  );
  return null;
}
export async function getSubstitutionsOn(date: string, stage: StageFilter): Promise<SubRow[]> {
  const params: unknown[] = [date];
  let where = " WHERE sb.duty_date = ?";
  if (stage !== "all") {
    where += " AND s.name = ?";
    params.push(stage);
  }
  const rows = await query<SubJoin>(
    `SELECT ${DUTY_COLUMNS}, ${SUB_COLUMNS} ${DUTY_FROM}
     JOIN substitutions sb ON sb.assignment_id = a.id ${where}
     ORDER BY sl.start_time`,
    params,
  );
  const people = await userMap();
  const out: SubRow[] = [];
  for (const r of rows) {
    const original = people.get(r.userId);
    const substitute = people.get(r.substituteId);
    if (original && substitute) out.push({ substitution: subOf(r), duty: dutyOf(r), original, substitute });
  }
  return out;
}

// ---------- Statistics ----------
export async function getStats(stage: StageFilter, from: string, to: string): Promise<StatsRow[]> {
  const stageSql = stage === "all" ? "" : " AND s.name = ?";
  const sql = `
    SELECT a.user_id AS userId, r.status AS status, TIME_TO_SEC(TIMEDIFF(sl.end_time, sl.start_time)) AS secs
    FROM attendance_records r
    JOIN assignments a ON a.id = r.assignment_id
    JOIN duty_slots sl ON sl.id = a.slot_id
    JOIN stages s ON s.id = sl.stage_id
    WHERE r.duty_date BETWEEN ? AND ? AND r.status IN ('present', 'late', 'absent')${stageSql}
    UNION ALL
    SELECT sb.substitute_user_id, sb.status, TIME_TO_SEC(TIMEDIFF(sl.end_time, sl.start_time))
    FROM substitutions sb
    JOIN assignments a ON a.id = sb.assignment_id
    JOIN duty_slots sl ON sl.id = a.slot_id
    JOIN stages s ON s.id = sl.stage_id
    WHERE sb.duty_date BETWEEN ? AND ? AND sb.status IN ('present', 'late', 'absent')${stageSql}`;
  const params = stage === "all" ? [from, to, from, to] : [from, to, stage, from, to, stage];
  const marks = await query<{ userId: number; status: AttendanceStatus; secs: number }>(sql, params);

  const people = await userMap();
  const rows = new Map<number, StatsRow>();
  const rowFor = (userId: number): StatsRow | undefined => {
    let row = rows.get(userId);
    if (!row) {
      const person = people.get(userId);
      if (!person) return undefined;
      row = { person, present: 0, late: 0, absent: 0, marked: 0, rate: 0, hours: 0, covered: 0, excused: 0 };
      rows.set(userId, row);
    }
    return row;
  };

  // Duties done as a substitute count for the substitute. Excused originals are not counted.
  for (const m of marks) {
    const row = rowFor(m.userId);
    if (!row) continue;
    row[m.status] += 1;
    row.marked += 1;
    if (m.status !== "absent") row.hours += Number(m.secs) / 3600;
  }

  // How many duties each person covered as a substitute, and how many of their own were covered.
  const subs = await query<{ coverId: number; excusedId: number }>(
    `SELECT sb.substitute_user_id AS coverId, a.user_id AS excusedId
     FROM substitutions sb
     JOIN assignments a ON a.id = sb.assignment_id
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     WHERE sb.duty_date BETWEEN ? AND ?${stageSql}`,
    stage === "all" ? [from, to] : [from, to, stage],
  );
  for (const sb of subs) {
    const cover = rowFor(sb.coverId);
    if (cover) cover.covered += 1;
    const excused = rowFor(sb.excusedId);
    if (excused) excused.excused += 1;
  }

  const list = [...rows.values()];
  list.forEach((row) => {
    row.rate = row.marked === 0 ? 0 : Math.round((row.present / row.marked) * 100);
  });
  return list.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
}

// ---------- Manage schedule ----------
export function getStageDuties(stage: StageFilter): Promise<Duty[]> {
  if (stage === "all") return query<Duty>(DUTY_SELECT + " ORDER BY sl.day_of_week, sl.start_time");
  return query<Duty>(DUTY_SELECT + " WHERE s.name = ? ORDER BY sl.day_of_week, sl.start_time", [stage]);
}

// Returns an error message, or null when the duty was saved.
export async function addDuty(n: NewDuty): Promise<string | null> {
  const stageRow = (await query<{ id: number }>("SELECT id FROM stages WHERE name = ?", [n.stage]))[0];
  if (!stageRow) return "Unknown stage.";
  const typeRow = (await query<{ id: number }>("SELECT id FROM duty_types WHERE code = ?", [n.type]))[0];
  if (!typeRow) return "Choose a duty type.";
  if (!(await findUser(n.userId))) return "Choose a teacher.";
  const place = String(n.place ?? "").trim();
  if (!place) return "Type a place.";
  if (place.length > 80) return "Use a shorter place name (80 characters at most).";
  if (!Number.isInteger(n.day) || n.day < 0 || n.day > 6) return "Choose a day.";
  if (!/^\d{2}:\d{2}$/.test(n.start) || !/^\d{2}:\d{2}$/.test(n.end)) return "Choose the start and end times.";
  if (minutes(n.end) <= minutes(n.start)) return "The end time must be after the start time.";

  const clash = (
    await query<Duty>(
      DUTY_SELECT + " WHERE a.user_id = ? AND sl.day_of_week = ? AND sl.start_time < ? AND ? < sl.end_time LIMIT 1",
      [n.userId, n.day, n.end + ":00", n.start + ":00"],
    )
  )[0];
  if (clash) {
    return `This teacher already has a duty at that time (${clash.place}, ${clash.stage}, ${clash.start} to ${clash.end}).`;
  }

  await run("INSERT IGNORE INTO areas (name) VALUES (?)", [place]);
  const area = (await query<{ id: number }>("SELECT id FROM areas WHERE name = ?", [place]))[0];
  if (!area) return "Could not save the place.";

  const existing = (
    await query<{ id: number }>(
      `SELECT id FROM duty_slots
       WHERE stage_id = ? AND duty_type_id = ? AND area_id = ? AND day_of_week = ? AND start_time = ? AND end_time = ?`,
      [stageRow.id, typeRow.id, area.id, n.day, n.start, n.end],
    )
  )[0];
  let slotId = existing?.id;
  if (slotId === undefined) {
    const result = await run(
      "INSERT INTO duty_slots (stage_id, duty_type_id, area_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)",
      [stageRow.id, typeRow.id, area.id, n.day, n.start, n.end],
    );
    slotId = result.insertId;
  }
  await run("INSERT INTO assignments (slot_id, user_id) VALUES (?, ?)", [slotId, n.userId]);
  return null;
}

export async function deleteDuty(id: number): Promise<string | null> {
  const used = await query<{ n: number }>(
    "SELECT 1 AS n FROM attendance_records WHERE assignment_id = ? UNION ALL SELECT 1 FROM substitutions WHERE assignment_id = ? LIMIT 1",
    [id, id],
  );
  if (used.length > 0) return "This duty has attendance or substitution history, so it cannot be deleted. History is kept so the statistics and the audit stay correct.";
  const slot = (await query<{ slot_id: number }>("SELECT slot_id FROM assignments WHERE id = ?", [id]))[0];
  await run("DELETE FROM assignments WHERE id = ?", [id]);
  if (slot) {
    // Remove the slot too when nobody else is on it.
    await run("DELETE FROM duty_slots WHERE id = ? AND NOT EXISTS (SELECT 1 FROM assignments WHERE slot_id = ?)", [
      slot.slot_id, slot.slot_id,
    ]);
  }
  return null;
}

// ---------- Duty types ----------
export async function getDutyTypeCounts(): Promise<Record<string, number>> {
  const rows = await query<{ code: string; n: number }>(
    `SELECT t.code AS code, COUNT(*) AS n FROM assignments a
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN duty_types t ON t.id = sl.duty_type_id
     GROUP BY t.code`,
  );
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    out[r.code] = Number(r.n);
  });
  return out;
}

export async function addDutyType(name: string, colour: string, weight: number): Promise<string | null> {
  const clean = name.trim();
  const code = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!code) return "Type a name.";
  if (clean.length > 40) return "Use a shorter name (40 characters at most).";
  const exists = await query<{ n: number }>("SELECT 1 AS n FROM duty_types WHERE code = ? LIMIT 1", [code]);
  if (exists.length > 0) return "A duty type with this name already exists.";
  const safeColour = /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : "#6b7a90";
  const safeWeight = Number.isFinite(weight) && weight >= 0 && weight < 100 ? weight : 1;
  await run("INSERT INTO duty_types (code, name, colour, weight) VALUES (?, ?, ?, ?)", [code, clean, safeColour, safeWeight]);
  return null;
}

// ---------- Staff and roles ----------
const allRoles: Role[] = ["teacher", "supervisor", "head_of_stage", "admin", "matron", "hr"];

export async function setUserRole(
  userId: number,
  role: Role,
  homeStage: StageName | undefined,
  actingUserId: number,
): Promise<string | null> {
  if (!(await findUser(userId))) return "Person not found.";
  if (!allRoles.includes(role)) return "Unknown role.";
  if (userId === actingUserId && role !== "admin") return "You cannot remove your own admin role.";
  if (role === "head_of_stage" && !homeStage) return "Choose the stage this head of stage is responsible for.";
  await run("UPDATE users SET role = ?, stage_id = (SELECT id FROM stages WHERE name = ?) WHERE id = ?", [
    role, homeStage ?? null, userId,
  ]);
  return null;
}

export async function getMySubstitutionSummary(userId: number): Promise<SubstitutionSummary> {
  const row = (
    await query<{ covered: number; excused: number }>(
      `SELECT (SELECT COUNT(*) FROM substitutions WHERE substitute_user_id = ?) AS covered,
              (SELECT COUNT(*) FROM substitutions sb
               JOIN assignments a ON a.id = sb.assignment_id WHERE a.user_id = ?) AS excused`,
      [userId, userId],
    )
  )[0];
  return { covered: Number(row?.covered ?? 0), excused: Number(row?.excused ?? 0) };
}

// ---------- Statistics: how complete is the data? ----------
export async function getStatsCoverage(stage: StageFilter, from: string, to: string): Promise<Coverage> {
  const today = new Date().toISOString().slice(0, 10);
  const end = to < today ? to : today; // future duties cannot be marked yet

  const dutyDays = await query<{ day: number; n: number }>(
    `SELECT sl.day_of_week AS day, COUNT(*) AS n
     FROM assignments a
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     ${stage === "all" ? "" : "WHERE s.name = ?"}
     GROUP BY sl.day_of_week`,
    stage === "all" ? [] : [stage],
  );

  // Count how many scheduled duties fall inside the period (each weekday has its own count).
  let expected = 0;
  const last = new Date(end + "T12:00:00");
  for (let d = new Date(from + "T12:00:00"); d <= last; d.setDate(d.getDate() + 1)) {
    const match = dutyDays.find((x) => x.day === d.getDay());
    if (match) expected += Number(match.n);
  }

  const stageAnd = stage === "all" ? "" : " AND s.name = ?";
  const params = stage === "all" ? [from, end] : [from, end, stage];
  const own = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM attendance_records r
     JOIN assignments a ON a.id = r.assignment_id
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     WHERE r.duty_date BETWEEN ? AND ? AND r.status IN ('present', 'late', 'absent')${stageAnd}`,
    params,
  );
  const covered = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM substitutions sb
     JOIN assignments a ON a.id = sb.assignment_id
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     WHERE sb.duty_date BETWEEN ? AND ? AND sb.status IN ('present', 'late', 'absent')${stageAnd}`,
    params,
  );
  return { expected, recorded: Number(own[0]?.n ?? 0) + Number(covered[0]?.n ?? 0) };
}

// ---------- Notifications ----------
export async function createNotification(
  userId: number,
  kind: string,
  title: string,
  body: string,
  createdBy: number | null,
): Promise<void> {
  await run("INSERT INTO notifications (user_id, kind, title, body, created_by) VALUES (?, ?, ?, ?, ?)", [
    userId, kind, title, body, createdBy,
  ]);
}

export async function getNotifications(userId: number): Promise<AppNotification[]> {
  const rows = await query<{
    id: number; kind: string; title: string; body: string; createdAt: string; isRead: number; fromName: string | null;
  }>(
    `SELECT n.id AS id, n.kind AS kind, n.title AS title, n.body AS body, n.created_at AS createdAt,
            (n.read_at IS NOT NULL) AS isRead, u.full_name AS fromName
     FROM notifications n LEFT JOIN users u ON u.id = n.created_by
     WHERE n.user_id = ?
     ORDER BY n.id DESC LIMIT 100`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id, kind: r.kind, title: r.title, body: r.body, createdAt: r.createdAt,
    read: Boolean(r.isRead), fromName: r.fromName,
  }));
}

export async function countUnread(userId: number): Promise<number> {
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", [userId]);
  return Number(rows[0]?.n ?? 0);
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  await run("UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL", [id, userId]);
}

export async function markAllRead(userId: number): Promise<void> {
  await run("UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL", [userId]);
}

// Tells the teachers on the given duties that their duty is starting.
// When a duty has a substitute, the substitute is told. An excused teacher is not.
export async function notifyDuties(dutyIds: number[], date: string, createdBy: number): Promise<number> {
  if (dutyIds.length === 0) return 0;
  const duties = await query<Duty>(DUTY_SELECT + " WHERE a.id IN (?)", [dutyIds]);
  const subs = await query<{ assignment_id: number; substitute_user_id: number }>(
    "SELECT assignment_id, substitute_user_id FROM substitutions WHERE duty_date = ? AND assignment_id IN (?)",
    [date, dutyIds],
  );
  const types = await getDutyTypes();
  let sent = 0;
  for (const d of duties) {
    const sub = subs.find((s) => s.assignment_id === d.id);
    const recipient = sub ? sub.substitute_user_id : d.userId;
    const typeName = types.find((t) => t.code === d.type)?.name ?? d.type;
    await createNotification(
      recipient,
      "duty-reminder",
      "Your duty is starting",
      `${typeName} at ${d.place} (${d.stage}), ${d.start} to ${d.end}, ${date}.`,
      createdBy,
    );
    sent += 1;
  }
  return sent;
}

// ---------- Automatic reminders ----------
// Sends one reminder per duty that starts within the next `ahead` minutes.
// The reminder_log table stops it from sending the same reminder twice.
export async function runReminders(date: string, nowMinutes: number, ahead: number): Promise<number> {
  const duties = await query<Duty>(
    DUTY_SELECT +
      " WHERE sl.day_of_week = ? AND TIME_TO_SEC(sl.start_time) > ? AND TIME_TO_SEC(sl.start_time) <= ? ORDER BY sl.start_time",
    [weekdayOf(date), nowMinutes * 60, (nowMinutes + ahead) * 60],
  );
  if (duties.length === 0) return 0;

  const ids = duties.map((d) => d.id);
  const subs = await query<{ assignment_id: number; substitute_user_id: number }>(
    "SELECT assignment_id, substitute_user_id FROM substitutions WHERE duty_date = ? AND assignment_id IN (?)",
    [date, ids],
  );
  const requested = await query<{ assignment_id: number }>(
    "SELECT assignment_id FROM substitution_requests WHERE duty_date = ? AND status = 'open' AND assignment_id IN (?)",
    [date, ids],
  );
  const types = await getDutyTypes();

  let sent = 0;
  for (const d of duties) {
    const sub = subs.find((s) => s.assignment_id === d.id);
    // A teacher who asked for a substitute for this duty is not reminded, unless someone is covering.
    if (!sub && requested.some((r) => r.assignment_id === d.id)) continue;

    const logged = await run("INSERT IGNORE INTO reminder_log (assignment_id, duty_date) VALUES (?, ?)", [d.id, date]);
    if (logged.affectedRows === 0) continue; // already sent

    const typeName = types.find((t) => t.code === d.type)?.name ?? d.type;
    await createNotification(
      sub ? sub.substitute_user_id : d.userId,
      "duty-reminder",
      "Your duty starts soon",
      `${typeName} at ${d.place} (${d.stage}) starts at ${d.start}, in ${minutes(d.start) - nowMinutes} minutes.`,
      null,
    );
    sent += 1;
  }
  return sent;
}
// Used by the demo tool, so a reminder can be sent again for the same date.
export async function clearReminderLog(date: string): Promise<void> {
  await run("DELETE FROM reminder_log WHERE duty_date = ?", [date]);
}

// ---------- Activity log ----------
// Writes one line in the log. actorId is null when the system itself did it.
export async function logActivity(
  actorId: number | null,
  action: string,
  summary: string,
  details?: unknown,
  outcome: "ok" | "denied" | "error" = "ok",
): Promise<void> {
  const raw = details === undefined ? null : JSON.stringify(details).slice(0, 2000);
  await run("INSERT INTO audit_log (actor_id, action, summary, details, outcome) VALUES (?, ?, ?, ?, ?)", [
    actorId, action, summary.slice(0, 500), raw, outcome,
  ]);
}

interface AuditFilter {
  from: string;
  to: string;
  actor: string; // a user id, "system", or "" for everyone
  action: string; // an action code, or "" for all
  q: string; // text to look for
  limit: number;
}

export async function getAuditLog(f: AuditFilter): Promise<AuditEntry[]> {
  const where: string[] = ["a.created_at >= ?", "a.created_at < DATE_ADD(?, INTERVAL 1 DAY)"];
  const params: unknown[] = [f.from, f.to];
  if (f.actor === "system") {
    where.push("a.actor_id IS NULL");
  } else if (f.actor) {
    where.push("a.actor_id = ?");
    params.push(Number(f.actor));
  }
  if (f.action) {
    where.push("a.action = ?");
    params.push(f.action);
  }
  if (f.q) {
    where.push("(a.summary LIKE ? OR u.full_name LIKE ?)");
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  const rows = await query<{
    id: number; createdAt: string; actorId: number | null; actorName: string | null; actorRole: string | null;
    action: string; summary: string; details: string | null; outcome: "ok" | "denied" | "error";
  }>(
    `SELECT a.id AS id, a.created_at AS createdAt, a.actor_id AS actorId, u.full_name AS actorName,
            u.role AS actorRole, a.action AS action, a.summary AS summary, a.details AS details, a.outcome AS outcome
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where.join(" AND ")}
     ORDER BY a.id DESC
     LIMIT ?`,
    [...params, f.limit],
  );
  return rows.map((r) => ({ ...r, actorName: r.actorName ?? "System" }));
}

// ---------- Statistics: the records behind the numbers ----------
interface RawRecord {
  id: string;
  date: string;
  status: StatRecord["status"];
  personId: number;
  personName: string;
  subject: string | null;
  excusedId?: number;
  excusedName?: string;
  excusedSubject?: string | null;
  stage: StageName;
  type: string;
  place: string;
  day: number;
  start: string;
  end: string;
  secs: number;
  byName: string | null;
}

const RECORD_DUTY_COLUMNS = `
  s.name AS stage, t.code AS type, ar.name AS place, sl.day_of_week AS day,
  TIME_FORMAT(sl.start_time, '%H:%i') AS \`start\`, TIME_FORMAT(sl.end_time, '%H:%i') AS \`end\`,
  TIME_TO_SEC(TIMEDIFF(sl.end_time, sl.start_time)) AS secs`;

export async function getStatRecords(stage: StageFilter, from: string, to: string): Promise<StatRecord[]> {
  const stageSql = stage === "all" ? "" : " AND s.name = ?";
  const stageParams = stage === "all" ? [] : [stage];

  // Duties marked by a supervisor.
  const own = await query<RawRecord>(
    `SELECT CONCAT('a-', r.id) AS id, r.duty_date AS \`date\`, r.status AS status,
            u.id AS personId, u.full_name AS personName, u.subject AS subject,
            ${RECORD_DUTY_COLUMNS}, m.full_name AS byName
     FROM attendance_records r
     JOIN assignments a ON a.id = r.assignment_id
     JOIN users u ON u.id = a.user_id
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     JOIN duty_types t ON t.id = sl.duty_type_id
     JOIN areas ar ON ar.id = sl.area_id
     LEFT JOIN users m ON m.id = r.marked_by
     WHERE r.duty_date BETWEEN ? AND ? AND r.status IN ('present', 'late', 'absent')${stageSql}`,
    [from, to, ...stageParams],
  );

  // Substitutions: the substitute does the duty, the original teacher is excused.
  const covered = await query<RawRecord>(
    `SELECT CONCAT('s-', sb.id) AS id, sb.duty_date AS \`date\`, sb.status AS status,
            su.id AS personId, su.full_name AS personName, su.subject AS subject,
            ou.id AS excusedId, ou.full_name AS excusedName, ou.subject AS excusedSubject,
            ${RECORD_DUTY_COLUMNS}, m.full_name AS byName
     FROM substitutions sb
     JOIN assignments a ON a.id = sb.assignment_id
     JOIN users su ON su.id = sb.substitute_user_id
     JOIN users ou ON ou.id = a.user_id
     JOIN duty_slots sl ON sl.id = a.slot_id
     JOIN stages s ON s.id = sl.stage_id
     JOIN duty_types t ON t.id = sl.duty_type_id
     JOIN areas ar ON ar.id = sl.area_id
     LEFT JOIN users m ON m.id = sb.added_by
     WHERE sb.duty_date BETWEEN ? AND ?${stageSql}`,
    [from, to, ...stageParams],
  );

  const toRecord = (r: RawRecord, kind: StatRecord["kind"]): StatRecord => ({
    id: r.id,
    date: r.date,
    kind,
    status: r.status,
    personId: r.personId,
    personName: r.personName,
    subject: r.subject,
    excusedId: r.excusedId ?? null,
    excusedName: r.excusedName ?? null,
    excusedSubject: r.excusedSubject ?? null,
    stage: r.stage,
    type: r.type,
    place: r.place,
    day: r.day,
    start: r.start,
    end: r.end,
    hours: Number(r.secs) / 3600,
    byName: r.byName,
  });

  return [...own.map((r) => toRecord(r, "own")), ...covered.map((r) => toRecord(r, "substitute"))]
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start))
    .slice(0, 5000);
}

// ---------- For the HR portal: may this teacher take leave? ----------
// A duty is "requested" when a request exists, and "covered" when a substitute is assigned.
export async function getLeaveCheck(
  userId: number,
  date: string,
  from: string,
  to: string,
  need: "requested" | "covered",
): Promise<LeaveCheck | null> {
  const teacher = await findUser(userId);
  if (!teacher) return null;
  const rows = await query<Duty & { reqStatus: string | null; subId: number | null; subName: string | null }>(
    `SELECT ${DUTY_COLUMNS}, q.status AS reqStatus, sb.id AS subId, su.full_name AS subName
     ${DUTY_FROM}
     LEFT JOIN substitution_requests q ON q.assignment_id = a.id AND q.duty_date = ? AND q.status <> 'cancelled'
     LEFT JOIN substitutions sb ON sb.assignment_id = a.id AND sb.duty_date = ?
     LEFT JOIN users su ON su.id = sb.substitute_user_id
     WHERE a.user_id = ? AND sl.day_of_week = ? AND sl.start_time < ? AND ? < sl.end_time
     ORDER BY sl.start_time`,
    [date, date, userId, weekdayOf(date), to + ":00", from + ":00"],
  );
  const duties: LeaveCheckDuty[] = rows.map((r) => ({
    dutyId: r.id,
    type: r.type,
    place: r.place,
    stage: r.stage,
    start: r.start,
    end: r.end,
    state: r.subId !== null ? "covered" : r.reqStatus ? "requested" : "none",
    substitute: r.subName,
  }));
  const allowed = duties.every((d) => (need === "covered" ? d.state === "covered" : d.state !== "none"));
  return { allowed, need, teacher: teacher.fullName, date, duties };
}

// ---------- The normal number of duties ----------
export async function getNormalDuties(): Promise<NormalDuties> {
  const setting = (await query<{ v: string }>("SELECT setting_value AS v FROM settings WHERE name = 'normal_duties_per_week'"))[0];
  const rows = await query<{ id: number; target: number }>(
    "SELECT id, CAST(weekly_target AS DOUBLE) AS target FROM users WHERE weekly_target IS NOT NULL",
  );
  const perUser: Record<number, number> = {};
  rows.forEach((r) => {
    perUser[r.id] = Number(r.target);
  });
  return { default: Number(setting?.v ?? 5), perUser };
}

export async function setNormalDefault(value: number): Promise<string | null> {
  if (!Number.isFinite(value) || value < 0 || value > 50) return "Enter a number between 0 and 50.";
  await run(
    "INSERT INTO settings (name, setting_value) VALUES ('normal_duties_per_week', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [String(value)],
  );
  return null;
}

// value null means "use the school default".
export async function setUserTarget(userId: number, value: number | null): Promise<string | null> {
  if (!(await findUser(userId))) return "Person not found.";
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 50)) {
    return "Enter a number between 0 and 50, or leave it empty for the school default.";
  }
  await run("UPDATE users SET weekly_target = ? WHERE id = ?", [value, userId]);
  return null;
}