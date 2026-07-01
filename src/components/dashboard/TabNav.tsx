import Link from "next/link";
import type { ReactNode } from "react";

export interface TabNavItem<TId extends string = string> {
  href: string;
  id: TId;
  label: string;
}

export function TabNav<TId extends string>({
  activeTab,
  ariaLabel,
  endAdornment,
  tabs,
}: {
  activeTab: TId;
  ariaLabel: string;
  endAdornment?: ReactNode;
  tabs: Array<TabNavItem<TId>>;
}) {
  return (
    <div
      className="flex w-full gap-2 overflow-x-auto border-b border-[var(--color-tab-border)] bg-[var(--color-tab-surface)]"
    >
      <nav aria-label={ariaLabel} className="flex min-w-0 flex-1 gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-focus-ring)] ${
                isActive
                  ? "border-[var(--color-tab-active-border)] text-[var(--color-tab-active-text)]"
                  : "border-transparent text-[var(--color-tab-text)] hover:border-[var(--color-tab-hover-border)] hover:text-[var(--color-tab-hover-text)]"
              }`}
              href={tab.href}
              key={tab.id}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {endAdornment ? (
        <div className="sticky right-0 flex shrink-0 items-center bg-[var(--color-tab-surface)] py-1 pl-2">
          {endAdornment}
        </div>
      ) : null}
    </div>
  );
}
