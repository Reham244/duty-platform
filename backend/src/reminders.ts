import { runReminders } from "./services.js";

// How many minutes before a duty the reminder is sent. Set REMINDER_MINUTES in .env to change it.
const AHEAD = Number(process.env.REMINDER_MINUTES ?? 10);

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Checks once a minute. It uses the server's clock and date.
export function startReminders(): void {
  const tick = () => {
    const now = new Date();
    runReminders(localDate(now), now.getHours() * 60 + now.getMinutes(), AHEAD)
      .then((sent) => {
        if (sent > 0) console.log(`Sent ${sent} duty reminder(s)`);
      })
      .catch((e: Error) => console.error("Reminder check failed:", e.message));
  };
  setInterval(tick, 60 * 1000);
  tick();
  console.log(`Reminders on: duties are announced ${AHEAD} minutes before they start.`);
}