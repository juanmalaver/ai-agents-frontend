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
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DASHBOARD_TIME_ZONE,
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

export function formatDashboardTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dashboardTimestampFormatter.format(date);
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
