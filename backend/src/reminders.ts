import { logActivity, runReminders } from "./services.js";
import { logSystem, purgeSystemLog } from "./systemLog.js";

// How many minutes before a duty the reminder is sent. Set REMINDER_MINUTES in .env to change it.
const AHEAD = Number(process.env.REMINDER_MINUTES ?? 10);
// How many days the system log is kept. Set SYSTEM_LOG_DAYS in .env to change it.
const KEEP_DAYS = Number(process.env.SYSTEM_LOG_DAYS ?? 14);

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Checks once a minute. It uses the server's clock and date.
export function startReminders(): void {
  const tick = () => {
    const now = new Date();
    const date = localDate(now);
    runReminders(date, now.getHours() * 60 + now.getMinutes(), AHEAD)
      .then(async (sent) => {
        if (sent > 0) {
          console.log(`Sent ${sent} duty reminder(s)`);
          await logActivity(null, "reminders.auto", `Sent ${sent} automatic duty reminder(s) for ${date}`, { sent, date });
          logSystem("info", "scheduler", `Sent ${sent} automatic duty reminder(s) for ${date}`, { details: { sent, date } });
        }
      })
      .catch((e: Error) => {
        console.error("Reminder check failed:", e.message);
        logSystem("error", "scheduler", `Reminder check failed: ${e.message}`);
      });
  };
  setInterval(tick, 60 * 1000);
  tick();
  console.log(`Reminders on: duties are announced ${AHEAD} minutes before they start.`);

  // Every few hours, remove system log lines older than KEEP_DAYS.
  const purge = () => {
    purgeSystemLog(KEEP_DAYS)
      .then((removed) => {
        if (removed > 0) logSystem("info", "scheduler", `Removed ${removed} system log lines older than ${KEEP_DAYS} days`);
      })
      .catch((e: Error) => console.error("Could not purge the system log:", e.message));
  };
  setInterval(purge, 6 * 60 * 60 * 1000);
  purge();
}