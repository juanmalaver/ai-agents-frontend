import type { KpiCardsGridProps } from "@/src/types/dashboard";
import { KpiCard } from "./KpiCard";

export function KpiCardsGrid({ items }: KpiCardsGridProps) {
  return (
    <section
      aria-label="Aggregate campaign KPIs"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
    >
      {items.map((item) => (
        <KpiCard item={item} key={item.id} />
      ))}
    </section>
  );
}
