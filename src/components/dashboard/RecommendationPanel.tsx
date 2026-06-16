import type {
  RecommendationPanelProps,
  RecommendationPanelViewModel,
  RecommendationPriority,
} from "@/src/types/dashboard";
import { formatPercentage } from "@/src/utils/dashboardFormatters";

const priorityStyles: Record<RecommendationPriority, string> = {
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
  high: "bg-sky-100 text-sky-800 ring-sky-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
};

export function RecommendationPanel({
  recommendation,
  stateName,
}: RecommendationPanelProps) {
  const viewModel = toViewModel(recommendation, stateName);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            AI recommendation for {viewModel.stateName}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {viewModel.summary}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${priorityStyles[recommendation.priority]}`}
          >
            {viewModel.priorityLabel}
          </span>
          {recommendation.status ? (
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {recommendation.status}
            </span>
          ) : null}
        </div>
      </div>

      {viewModel.rationale ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {viewModel.rationale}
        </p>
      ) : null}

      {viewModel.actions.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">
            Recommended actions
          </p>
          <ul className="mt-2 grid gap-2 text-sm text-slate-700">
            {viewModel.actions.map((action) => (
              <li className="rounded-md border border-slate-200 bg-white p-3" key={action}>
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No recommended actions are available.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {viewModel.confidenceLabel ? (
          <span>Confidence: {viewModel.confidenceLabel}</span>
        ) : null}
        {viewModel.generatedAtLabel ? (
          <span>Generated: {viewModel.generatedAtLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function toViewModel(
  recommendation: RecommendationPanelProps["recommendation"],
  stateName: string,
): RecommendationPanelViewModel {
  return {
    actions: recommendation.actions.map((action) =>
      [action.label, action.description, action.impact]
        .filter(Boolean)
        .join(" - "),
    ),
    confidenceLabel:
      recommendation.confidenceScore == null
        ? undefined
        : formatPercentage(recommendation.confidenceScore),
    generatedAtLabel: recommendation.generatedAt
      ? new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(recommendation.generatedAt))
      : undefined,
    priorityLabel: recommendation.priority,
    rationale: recommendation.rationale,
    stateName,
    summary: recommendation.summary,
  };
}
