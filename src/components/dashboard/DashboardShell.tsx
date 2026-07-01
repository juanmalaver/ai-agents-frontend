"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

type DashboardShellItem = "approvals" | "dashboard";

interface DashboardShellProps {
  activeItem: DashboardShellItem;
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "ai-dashboard-sidebar-collapsed";

const navItems: Array<{
  href: string;
  id: DashboardShellItem;
  label: string;
}> = [
  {
    href: "/marketing-dashboard/combined",
    id: "dashboard",
    label: "Dashboard",
  },
  {
    href: "/approvals",
    id: "approvals",
    label: "Approvals",
  },
];

export function DashboardShell({ activeItem, children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setIsCollapsed(
      window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
    );
  }, []);

  function toggleCollapsed() {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-app-text)]">
      <div className="flex min-h-screen">
        <aside
          className={`hidden shrink-0 border-r border-[var(--color-app-border)] bg-[var(--color-app-surface)] transition-[width] duration-200 md:flex md:flex-col ${
            isCollapsed ? "w-20" : "w-64"
          }`}
        >
          <SidebarContent
            activeItem={activeItem}
            isCollapsed={isCollapsed}
            onNavigate={() => setIsMobileOpen(false)}
            onToggleCollapsed={toggleCollapsed}
          />
        </aside>

        {isMobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 h-full w-full bg-[var(--color-app-overlay)]"
              onClick={() => setIsMobileOpen(false)}
              type="button"
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-[var(--color-app-border)] bg-[var(--color-app-surface)] shadow-2xl">
              <SidebarContent
                activeItem={activeItem}
                isCollapsed={false}
                onNavigate={() => setIsMobileOpen(false)}
                onToggleCollapsed={() => setIsMobileOpen(false)}
              />
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="sticky top-[54px] z-20 border-b border-[var(--color-app-border)] bg-[var(--color-app-surface-glass)] px-4 py-2 shadow-sm backdrop-blur md:hidden">
            <button
              aria-label="Open navigation"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--color-control-border)] bg-[var(--color-control-bg)] text-[var(--color-control-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              onClick={() => setIsMobileOpen(true)}
              type="button"
            >
              <HamburgerIcon />
            </button>
          </div>
          <div className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SidebarContent({
  activeItem,
  isCollapsed,
  onNavigate,
  onToggleCollapsed,
}: {
  activeItem: DashboardShellItem;
  isCollapsed: boolean;
  onNavigate: () => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      <div
        className={`flex h-16 items-center border-b border-[var(--color-app-border)] px-4 ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {isCollapsed ? null : (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-app-text)]">
              AI Agents
            </p>
            <p className="text-xs text-[var(--color-app-text-muted)]">
              Workspace
            </p>
          </div>
        )}
        <button
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--color-control-border)] bg-[var(--color-control-bg)] text-[var(--color-control-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          onClick={onToggleCollapsed}
          type="button"
        >
          <HamburgerIcon />
        </button>
      </div>

      <nav
        aria-label="Workspace navigation"
        className="flex flex-1 flex-col gap-1 px-3 py-4"
      >
        {navItems.map((item) => {
          const isActive = item.id === activeItem;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--color-nav-active-bg)] text-[var(--color-nav-active-text)] ring-1 ring-inset ring-[var(--color-nav-active-ring)]"
                  : "text-[var(--color-nav-text)] hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-nav-hover-text)]"
              } ${isCollapsed ? "justify-center" : ""}`}
              href={item.href}
              key={item.id}
              onClick={onNavigate}
              title={isCollapsed ? item.label : undefined}
            >
              <NavGlyph label={item.label} />
              {isCollapsed ? null : <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function HamburgerIcon() {
  return (
    <span aria-hidden="true" className="flex w-5 flex-col gap-1">
      <span className="h-0.5 rounded-full bg-current" />
      <span className="h-0.5 rounded-full bg-current" />
      <span className="h-0.5 rounded-full bg-current" />
    </span>
  );
}

function NavGlyph({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-nav-glyph-bg)] text-xs font-semibold text-[var(--color-nav-glyph-text)]"
    >
      {label.slice(0, 1)}
    </span>
  );
}
