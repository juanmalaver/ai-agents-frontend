import type { DashboardHeaderProps } from "@/src/types/dashboard";

export function DashboardHeader({
  lastUpdated,
  subtitle,
  title,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {subtitle}
          </p>
        ) : null}
      </div>
      {lastUpdated ? (
        <p className="text-sm text-slate-500">Last updated: {lastUpdated}</p>
      ) : null}
    </header>
  );
}
