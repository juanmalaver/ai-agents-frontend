import type {
  DashboardQueryParams,
  DashboardTabId,
} from "@/src/types/dashboard";
import { appendDashboardQueryParams } from "@/src/utils/runtimeApiUrls";
import { TabNav } from "./TabNav";

const tabs: Array<{ href: string; id: DashboardTabId; label: string }> = [
  {
    href: "/marketing-dashboard/combined",
    id: "combined",
    label: "Ad Performance",
  },
  {
    href: "/marketing-dashboard",
    id: "overview",
    label: "Meta",
  },
  {
    href: "/marketing-dashboard/tiktok",
    id: "tiktok",
    label: "TikTok",
  },
  {
    href: "/marketing-dashboard/health",
    id: "health",
    label: "Audit",
  },
  {
    href: "/marketing-dashboard/campaigns",
    id: "campaigns",
    label: "AI Rec.",
  },
];

export function DashboardTabs({
  activeTab,
  query,
}: {
  activeTab: DashboardTabId;
  query?: DashboardQueryParams;
}) {
  return (
    <TabNav
      activeTab={activeTab}
      ariaLabel="Marketing dashboard sections"
      tabs={tabs.map((tab) => ({
        ...tab,
        href: appendDashboardQueryParams(tab.href, query) ?? tab.href,
      }))}
    />
  );
}
