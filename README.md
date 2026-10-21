# Duty Management Platform (prototype)

A standalone prototype for managing staff duties at the school: break, snack and dismissal duties
(and any other duty type the school adds), attendance, substitutions, statistics and notifications.
It is the first data source for the wider vision: one dynamic profile page per teacher.

**This is a prototype with dummy data.** It has no real login, no real staff list and no real delivery of
notifications. See "What is dummy" below before showing or deploying it.

## Stack

| Part | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL 8.0.19 or newer (`mysql2` driver) |

## Folder structure

```
duty-platform/
  database/duty-platform-mysql.sql   creates the database and loads dummy data
  backend/
    .env                             your local settings (not in Git)
    src/
      index.ts                       starts the server
      routes.ts                      the HTTP addresses and which roles may use them
      auth.ts                        who is asking (demo header) and role/stage checks
      services.ts                    all rules and database queries
      db.ts                          the MySQL connection
      types.ts                       data shapes (a copy of frontend/src/types.ts)
  frontend/
    src/
      App.tsx                        chooses the screen for the person and menu item
      api.ts                         the ONLY file that talks to the backend
      roles.ts                       which screens each role can open
      bell.ts                        dummy bell times (sessions, snacks, break, dismissal) per stage
      components/                    one file per screen, plus small shared pieces
      types.ts                       data shapes (a copy of backend/src/types.ts)
```

Keep `backend/src/types.ts` and `frontend/src/types.ts` identical. Whoever changes one copies the change to the other.

## Run it on your computer

You need Node.js (LTS), Git and MySQL 8.0.19 or newer.

1. **Database.** Open `database/duty-platform-mysql.sql` in MySQL Workbench on a connected tab and run all of it.
   It drops and recreates the `duty_platform` database. Expected row counts at the end:
   users 50, duty_slots 150, assignments 195, attendance_records 780, substitutions 1.
2. **Backend settings.** In `backend`, create a file named `.env` (it is ignored by Git):

   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=duty_platform
   ```
3. **Start the backend** (port 3000):

   ```
   cd backend
   npm install
   npm run dev
   ```

   You should see `Backend running on http://localhost:3000` and `Connected to MySQL`.
4. **Start the frontend** (port 5173), in a second terminal:

   ```
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:5173. The backend address is `BASE` at the top of `frontend/src/api.ts`.

**Reset the demo data:** run the SQL script again. The database goes back to its starting state.

## Roles and screens

| Role | Screens | Scope |
|---|---|---|
| Teacher | My duties, Notifications | Own data |
| Supervisor (discipline) | Attendance cards, Substitutions, Manage schedule, Notifications | All stages |
| Head of stage | Attendance cards, Substitutions, Manage schedule, Stage statistics, Notifications | Own stage only |
| Admin | Everything above, plus All stages statistics, Duty types, Staff and roles | All stages |
| HR | All stages statistics, Notifications | All stages |
| Matron | Session attendance (planned, not built) | Own classes |

A role says what a person can do. The scope (stage) says where. The backend checks both on every request
(`auth.ts`, `routes.ts`). Hiding a menu item is not security.

## Main rules

- Teachers cannot take permission or partial leave on a duty day. They are told so, and can report an emergency.
- A supervisor, head of stage or admin adds a substitute. The original teacher is **Excused** (not counted as
  missed); the substitute is counted, with the hours. Both are notified.
- A teacher cannot have two overlapping duties. A duty with attendance history cannot be deleted.
- Each stage has its own times. The stage of a duty comes from the duty, not from the teacher.
- Statistics count only marked duties. Attendance rate = present divided by marked duties. Hours count when
  present or late. Data completeness = marked duties divided by scheduled duties up to today.

## Data model

Nine tables: `stages`, `areas`, `duty_types`, `users`, `duty_slots`, `assignments`, `attendance_records`,
`substitutions`, `emergency_reports`, plus `notifications`. A "duty" in the app is an assignment (a teacher on
a slot) joined with the slot's stage, type, place, day and times. Duty types are data (name, colour, weight),
so new types need no code change. The planned general model for the wider vision is described in the
vision and roadmap document.

## API (all JSON; every address except `GET /users` needs the `x-user-id` header)

| Address | Who | Purpose |
|---|---|---|
| `GET /users`, `/stages`, `/duty-types`, `/duty-types/counts` | all | Lists |
| `POST /duty-types`, `PUT /users/:id/role` | admin | Add a duty type, change a role |
| `GET /users/:id/duties`, `/attendance`, `/substitute-duties`, `/substitution-summary`, `/emergency` | self or staff | A person's own data |
| `POST /emergencies` | self or staff | Report an emergency |
| `GET /cards`, `PUT /attendance`, `PUT /substitutions/:id/attendance` | supervisor, head, admin | Attendance cards and marks |
| `GET /needs-substitute`, `GET /duties/:id/available-substitutes`, `POST /substitutions`, `GET /substitutions` | supervisor, head, admin | Substitutions |
| `GET /stats`, `GET /stats/coverage` | head, admin, HR | Statistics and data completeness |
| `GET /schedule`, `POST /duties`, `DELETE /duties/:id` | supervisor, head, admin | Manage schedule |
| `GET /notifications`, `/notifications/unread-count`, `PUT /notifications/:id/read`, `/notifications/read-all` | all | Own notifications |
| `POST /notifications/duties` | supervisor, head, admin | Notify teachers on duty |

## What is dummy (to replace when this is integrated)

- **Login.** The "Demo, view as" dropdown and the `x-user-id` header stand in for real sign-in
  (`backend/src/auth.ts`, `frontend/src/App.tsx`). Anyone who can reach the backend can claim any identity.
  Replace this with the portal's sign-in before any real use.
- **People and roles.** The 50 users are dummy. Real names, employee IDs and subjects should come from the
  portal or HR system.
- **Schedules.** Dummy duties for three stages (Foundation, Elementary, Middle & High).
- **Bell times.** `frontend/src/bell.ts` computes sessions 1 to 10, snacks, break and dismissal for each stage
  from a few dummy times. The real times and the session timetable come from the LMS.
- **Demo date.** Some screens start on a fixed demo date and "pretend today is" selector (My duties).
- **Notifications** are stored in the database and shown in the platform only. Delivery to phones
  (push, SMS, WhatsApp, email) and automatic reminders before a duty are not built.

## Not built yet

Session attendance by matrons (schedule from the LMS), morning line, bus tracking, one-time events,
leave requests with HR approval, an audit log, Arabic and right-to-left layout, the teacher profile page,
more than one role per person.

## Hand-over checklist

- [ ] Real sign-in and staff list from the portal
- [ ] Decide the database host, backups and who maintains it
- [ ] Hosting and release process (development, testing, live)
- [ ] Audit log and view logging for staff performance data
- [ ] Confirm definitions with leadership and HR: late, excused cases, what the statistics are used for
- [ ] Replace dummy bell times with the LMS timetable
