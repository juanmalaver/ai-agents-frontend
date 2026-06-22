import type { DashboardDateRange } from "@/src/types/dashboard";

export function getCurrentMonthDateRange(now = new Date()): DashboardDateRange {
  const to = toDateInputValue(now);

  return {
    from: `${to.slice(0, 7)}-01`,
    to,
  };
}

export function isSameDateRange(
  left: DashboardDateRange,
  right: DashboardDateRange,
): boolean {
  return left.from === right.from && left.to === right.to;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
