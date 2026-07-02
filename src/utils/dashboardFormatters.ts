import type { NullableNumber } from "@/src/types/dashboard";

export const DASHBOARD_TIME_ZONE = "America/New_York";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  style: "percent",
});
const dashboardTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
  month: "2-digit",
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
});

export function formatCurrency(value: NullableNumber): string {
  if (!isValidNumber(value)) {
    return "-";
  }

  return currencyFormatter.format(value);
}

export function formatNumber(value: NullableNumber): string {
  if (!isValidNumber(value)) {
    return "-";
  }

  return numberFormatter.format(value);
}

export function formatPercentage(value: NullableNumber): string {
  if (!isValidNumber(value)) {
    return "-";
  }

  return percentageFormatter.format(value);
}

export function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatDashboardDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const inputDateParts = parseDateParts(value);

  if (inputDateParts) {
    return formatDateParts(inputDateParts);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return formatDateFromFormatterParts(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
      year: "numeric",
    }).formatToParts(parsedDate),
  );
}

export function formatDashboardDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from && !to) {
    return "-";
  }

  if (from && to && from === to) {
    return formatDashboardDate(from);
  }

  return `${formatDashboardDate(from)} to ${formatDashboardDate(to)}`;
}

export function formatDashboardTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const byType = Object.fromEntries(
    dashboardTimestampFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${byType.month}-${byType.day}-${byType.year}, ${byType.hour}:${byType.minute} ${byType.dayPeriod}`;
}

export function safeDivide(
  numerator: NullableNumber,
  denominator: NullableNumber,
): number | null {
  if (!isValidNumber(numerator) || !isValidNumber(denominator)) {
    return null;
  }

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function isValidNumber(value: NullableNumber): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDateParts(
  value: string,
): { day: string; month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return { day, month, year };
}

function formatDateParts({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}): string {
  return `${month}-${day}-${year}`;
}

function formatDateFromFormatterParts(parts: Intl.DateTimeFormatPart[]): string {
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return formatDateParts({
    day: byType.day,
    month: byType.month,
    year: byType.year,
  });
}
