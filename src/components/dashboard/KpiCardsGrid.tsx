import type { KpiCardsGridProps } from "@/src/types/dashboard";
import { KpiCard } from "./KpiCard";

export function KpiCardsGrid({
  ariaLabel = "Aggregate campaign KPIs",
  contextLabel,
  items,
}: KpiCardsGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      className="space-y-2"
    >
      {contextLabel ? (
        <div className="inline-flex w-fit rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
          {contextLabel}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {items.map((item) => (
          <KpiCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
