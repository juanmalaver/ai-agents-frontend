import Link from "next/link";
import type { DashboardTabId } from "@/src/types/dashboard";

const tabs: Array<{ href: string; id: DashboardTabId; label: string }> = [
  { href: "/marketing-dashboard", id: "overview", label: "Overview" },
  {
    href: "/marketing-dashboard/campaigns",
    id: "campaigns",
    label: "Campaigns",
  },
];

export function DashboardTabs({ activeTab }: { activeTab: DashboardTabId }) {
  return (
    <nav
      aria-label="Marketing dashboard sections"
      className="flex w-full gap-2 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "border-teal-500 text-slate-950"
                : "border-transparent text-slate-500 hover:border-sky-300 hover:text-slate-800"
            }`}
            href={tab.href}
            key={tab.id}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
