import { query, run } from "./db.js";
import type {
  AttendanceRow, AttendanceStatus, Candidate, Card, CardStatus, Duty, DutyTypeInfo, EmergencyReport,
  NeedRow, NewDuty, Role, StageName, StatsRow, SubRow, SubStatus, Substitution, SubstituteDuty, SubstitutionSummary, User, AppNotification, Coverage,
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
export async function reportEmergency(userId: number, date: string, message: string, actorId: number): Promise<void> {
  if (await hasEmergency(userId, date)) return;
  await run("INSERT INTO emergency_reports (user_id, report_date, message, status) VALUES (?, ?, ?, 'open')", [
    userId, date, message,
  ]);

  // Tell the people who arrange substitutes: supervisors, admins, and the head of each stage
  // the teacher works in that day.
  const day = weekdayOf(date);
  const teacher = await findUser(userId);
  const counted = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM assignments a JOIN duty_slots sl ON sl.id = a.slot_id
     WHERE a.user_id = ? AND sl.day_of_week = ?`,
    [userId, day],
  );
  const duties = Number(counted[0]?.n ?? 0);
  const recipients = await query<{ id: number }>(
    `SELECT u.id AS id FROM users u
     WHERE u.role IN ('supervisor', 'admin')
        OR (u.role = 'head_of_stage' AND u.stage_id IN (
              SELECT sl.stage_id FROM assignments a JOIN duty_slots sl ON sl.id = a.slot_id
              WHERE a.user_id = ? AND sl.day_of_week = ?))`,
    [userId, day],
  );
  for (const r of recipients) {
    if (r.id === actorId) continue; // the person who pressed the button already knows
    await createNotification(
      r.id,
      "substitution-request",
      "Substitution requested",
      `${teacher?.fullName ?? "A teacher"} needs a substitute on ${date} (${duties} ${duties === 1 ? "duty" : "duties"}).`,
      actorId,
    );
  }
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
  const reported = await query<{ user_id: number }>("SELECT user_id FROM emergency_reports WHERE report_date = ?", [date]);
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
    const card: Card = { duty: d, person, status, emergency: !sub && reported.some((r) => r.user_id === d.userId) };
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
  const reports = await query<{ id: number; userId: number; date: string; message: string | null; status: "open" | "handled" }>(
    "SELECT id, user_id AS userId, report_date AS `date`, message, status FROM emergency_reports WHERE report_date = ? AND status = 'open' ORDER BY id",
    [date],
  );
  const out: NeedRow[] = [];
  for (const rep of reports) {
    const person = await findUser(rep.userId);
    if (!person) continue;
    const params: unknown[] = [rep.userId, weekdayOf(date)];
    let where = " WHERE a.user_id = ? AND sl.day_of_week = ?";
    if (stage !== "all") {
      where += " AND s.name = ?";
      params.push(stage);
    }
    where += " AND NOT EXISTS (SELECT 1 FROM substitutions b WHERE b.assignment_id = a.id AND b.duty_date = ?)";
    params.push(date);
    const duties = await query<Duty>(DUTY_SELECT + where, params);
    const report: EmergencyReport = {
      id: rep.id, userId: rep.userId, date: rep.date, message: rep.message ?? "", status: rep.status,
    };
    duties.forEach((duty) => out.push({ report, person, duty }));
  }
  return out.sort((a, b) => a.duty.start.localeCompare(b.duty.start));
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
       AND NOT EXISTS (SELECT 1 FROM emergency_reports e WHERE e.user_id = u.id AND e.report_date = ?)
     ORDER BY cnt, u.full_name`,
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

  // When every duty of that teacher on that day is covered, the report is handled.
  const left = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM assignments a
     JOIN duty_slots sl ON sl.id = a.slot_id
     WHERE a.user_id = ? AND sl.day_of_week = ?
       AND NOT EXISTS (SELECT 1 FROM substitutions b WHERE b.assignment_id = a.id AND b.duty_date = ?)`,
    [duty.userId, weekdayOf(date), date],
  );
  if (Number(left[0]?.n ?? 0) === 0) {
    await run("UPDATE emergency_reports SET status = 'handled' WHERE user_id = ? AND report_date = ?", [duty.userId, date]);
  }

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
  if (used.length > 0) return "This duty has attendance history, so it cannot be deleted.";
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
  const requests = await query<{ user_id: number }>("SELECT user_id FROM emergency_reports WHERE report_date = ?", [date]);
  const types = await getDutyTypes();

  let sent = 0;
  for (const d of duties) {
    const sub = subs.find((s) => s.assignment_id === d.id);
    // A teacher who asked for a substitute is not reminded, unless someone is covering.
    if (!sub && requests.some((r) => r.user_id === d.userId)) continue;

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