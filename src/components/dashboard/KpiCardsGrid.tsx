import type { KpiCardsGridProps } from "@/src/types/dashboard";
import { KpiCard } from "./KpiCard";

export function KpiCardsGrid({
  ariaLabel = "Aggregate campaign KPIs",
  contextLabel,
  contextLabels,
  items,
}: KpiCardsGridProps) {
  const gridClassName =
    items.length === 5
      ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      : items.length === 7
        ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6";
  const contextChips = [
    ...(contextLabel ? [contextLabel] : []),
    ...(contextLabels ?? []),
  ].filter((label) => label.trim().length > 0);

  return (
    <section
      aria-label={ariaLabel}
      className="space-y-2"
    >
      {contextChips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {contextChips.map((label) => (
            <span
              className="inline-flex w-fit rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800"
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className={gridClassName}>
        {items.map((item) => (
          <KpiCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
