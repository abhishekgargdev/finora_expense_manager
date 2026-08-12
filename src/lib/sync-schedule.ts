import type { SyncScheduleType } from "@/models/GoogleSheetsSync";

type ScheduleInput = {
  scheduleType: SyncScheduleType;
  intervalDays?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  dayOfYear?: number;
  from?: Date;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function nextMonthlyDate(from: Date, dayOfMonth: number) {
  const base = startOfDay(from);
  const day = Math.min(Math.max(dayOfMonth, 1), 28);
  let candidate = new Date(base.getFullYear(), base.getMonth(), day);
  if (candidate <= base) {
    candidate = new Date(base.getFullYear(), base.getMonth() + 1, day);
  }
  return startOfDay(candidate);
}

function nextYearlyDate(from: Date, monthOfYear: number, dayOfYear: number) {
  const base = startOfDay(from);
  const month = Math.min(Math.max(monthOfYear, 1), 12);
  const day = Math.min(Math.max(dayOfYear, 1), 28);
  let candidate = new Date(base.getFullYear(), month - 1, day);
  if (candidate <= base) {
    candidate = new Date(base.getFullYear() + 1, month - 1, day);
  }
  return startOfDay(candidate);
}

export function calculateNextSyncAt(input: ScheduleInput) {
  const from = startOfDay(input.from ?? new Date());

  if (input.scheduleType === "interval") {
    const days = Math.min(Math.max(input.intervalDays ?? 30, 1), 365);
    return addDays(from, days);
  }

  if (input.scheduleType === "monthly") {
    return nextMonthlyDate(from, input.dayOfMonth ?? 1);
  }

  return nextYearlyDate(from, input.monthOfYear ?? 1, input.dayOfYear ?? 1);
}

export function getDaysUntilSync(nextSyncAt?: Date | null, now = new Date()) {
  if (!nextSyncAt) return null;
  const today = startOfDay(now).getTime();
  const target = startOfDay(nextSyncAt).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function shouldShowSyncReminder(nextSyncAt?: Date | null, reminderDays = 2) {
  const daysUntil = getDaysUntilSync(nextSyncAt);
  if (daysUntil === null) return false;
  return daysUntil >= 0 && daysUntil <= reminderDays;
}
