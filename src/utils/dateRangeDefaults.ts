import type { DashboardDateRange } from "@/src/types/dashboard";

const DASHBOARD_TIME_ZONE = "America/New_York";

export function getCurrentMonthDateRange(now = new Date()): DashboardDateRange {
  const to = toDateInputValue(now);

  return {
    from: `${to.slice(0, 7)}-01`,
    to,
  };
}

export function getYesterdayDateRange(now = new Date()): DashboardDateRange {
  const today = toDateInputValueInTimeZone(now, DASHBOARD_TIME_ZONE);
  const [year, month, day] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day));

  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const date = yesterday.toISOString().slice(0, 10);

  return { from: date, to: date };
}

export function isSameDateRange(
  left: DashboardDateRange,
  right: DashboardDateRange,
): boolean {
  return left.from === right.from && left.to === right.to;
}

export function constrainDateRangeDays(
  range: DashboardDateRange,
  maxRangeDays: number | undefined,
): DashboardDateRange {
  if (
    !maxRangeDays ||
    maxRangeDays <= 0 ||
    !range.from ||
    !range.to ||
    getInclusiveDateRangeDays(range.from, range.to) <= maxRangeDays
  ) {
    return range;
  }

  return {
    from: addDaysToDateInputValue(range.to, -(maxRangeDays - 1)),
    to: range.to,
  };
}

export function getInclusiveDateRangeDays(from: string, to: string): number {
  const fromDate = parseDateInputValue(from);
  const toDate = parseDateInputValue(to);

  if (!fromDate || !toDate || from > to) {
    return Number.POSITIVE_INFINITY;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return (
    Math.floor((toDate.getTime() - fromDate.getTime()) / millisecondsPerDay) + 1
  );
}

export function addDaysToDateInputValue(value: string, days: number): string {
  const date = parseDateInputValue(value);

  if (!date) {
    return value;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDateInputValueInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseDateInputValue(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}
