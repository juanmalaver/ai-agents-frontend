# Marketing Campaign Performance Dashboard Spec

## Purpose

Build a single-page React dashboard that displays marketing campaign performance by state and surfaces AI agent recommendations for each campaign row.

The dashboard should help campaign operators quickly answer:

- Are the aggregate KPIs on track?
- How are SL, SL Goal, and SL percentage performing over time?
- Which states are underperforming?
- What does the AI agent recommend for each state/campaign?

## Stack

- React with functional components and hooks
- Recharts for the composed chart
- TanStack Table v8 for the state-level campaign table
- Tailwind CSS for layout and styling

## Page Layout

The dashboard is one page with three stacked sections:

1. KPI Cards row
2. Campaign performance composed chart
3. Per-state campaign table with expandable AI recommendation rows

Recommended page structure:

```tsx
<DashboardPage>
  <DashboardHeader />
  <KpiCardsGrid />
  <CampaignPerformanceChart />
  <CampaignStateTable />
</DashboardPage>
```

## Component Tree

### `DashboardPage`

Top-level page container responsible for fetching data, handling loading/error states, and passing normalized data to child components.

Responsibilities:

- Fetch dashboard data from the REST API.
- Store API response in local state.
- Derive KPI statuses.
- Derive row health states for table coloring.
- Pass chart data, KPI data, and table rows to child components.
- Render loading, error, and empty states.

Props:

```ts
interface DashboardPageProps {
  apiUrl?: string;
}
```

State:

```ts
interface DashboardPageState {
  data: CampaignDashboardApiResponse | null;
  isLoading: boolean;
  error: string | null;
}
```

### `DashboardHeader`

Static page heading and optional last updated timestamp.

Props:

```ts
interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
}
```

### `KpiCardsGrid`

Responsive grid that renders one card per aggregate KPI.

Props:

```ts
interface KpiCardsGridProps {
  items: KpiCardData[];
}
```

### `KpiCard`

Displays the KPI label, formatted value, and status indicator.

Props:

```ts
interface KpiCardProps {
  item: KpiCardData;
}
```

### `CampaignPerformanceChart`

Recharts composed chart showing monthly SL performance.

Visual requirements:

- Dark chart panel background
- Green bars for actual SL
- Blue line for SL Goal
- White line for SL percentage to target
- Primary Y-axis for SL and SL Goal
- Secondary Y-axis for percentages
- Monthly X-axis granularity
- Tooltip with formatted values
- Legend for all series

Props:

```ts
interface CampaignPerformanceChartProps {
  data: MonthlyCampaignPerformance[];
  isLoading?: boolean;
}
```

Expected Recharts primitives:

- `ResponsiveContainer`
- `ComposedChart`
- `CartesianGrid`
- `XAxis`
- `YAxis`
- `Tooltip`
- `Legend`
- `Bar`
- `Line`

### `CampaignStateTable`

TanStack Table v8 implementation with expandable rows. Each row represents a campaign/state combination.

Props:

```ts
interface CampaignStateTableProps {
  rows: CampaignStateRow[];
}
```

Responsibilities:

- Define TanStack column definitions.
- Manage expanded row state locally.
- Render table headers, rows, and cells.
- Apply row health color based on `% Goal`.
- Render `RecommendationPanel` inside expanded row.

### `RecommendationPanel`

Expanded content rendered directly below the related state row.

Props:

```ts
interface RecommendationPanelProps {
  recommendation: AiAgentRecommendation;
  stateName: string;
}
```

Responsibilities:

- Show recommendation summary.
- Show priority/severity.
- Show recommended actions.
- Show rationale or supporting insight.
- Optionally show confidence score and generated timestamp.

## API Response Shape Assumption

The REST API should return a single JSON object with aggregate KPIs, monthly chart data, and state rows.

```ts
interface CampaignDashboardApiResponse {
  generatedAt: string;
  aggregatedKpis: AggregatedKpis;
  monthlyPerformance: MonthlyCampaignPerformance[];
  stateCampaigns: CampaignStateRow[];
}
```

### Aggregate KPIs

```ts
interface AggregatedKpis {
  finalCpl: number | null;
  cpsl: number | null;
  cpql: number | null;
  budgetSpentCompletionPct: number | null;
  slGoalCompletionPct: number | null;
  leadGoalCompletionPct: number | null;
  mtdSpentPct: number | null;
}
```

Notes:

- Percentage values should be decimals from `0` to `1` when possible.
- The UI formats decimal percentages as `0%` to `100%+`.
- Currency values should be raw numbers and formatted in the UI.
- Use `null` for unavailable values instead of spreadsheet strings such as `#DIV/0!`.

### Monthly Chart Data

```ts
interface MonthlyCampaignPerformance {
  month: string;
  sl: number;
  slGoal: number;
  slPctToTarget: number | null;
}
```

Field notes:

- `month` should be an ISO-like month key such as `2026-01`.
- `sl` is the actual monthly SL value.
- `slGoal` is the monthly target.
- `slPctToTarget` is derived as `sl / slGoal`, or `null` when `slGoal` is zero or missing.

### State Campaign Rows

```ts
interface CampaignStateRow {
  id: string;
  state: CampaignStateName;
  budget: number | null;
  slGoal: number | null;
  leadsGoal: number | null;
  mtdSpent: number | null;
  spentPct: number | null;
  goalPct: number | null;
  cpsl: number | null;
  mtdSl: number | null;
  leads: number | null;
  conversionRate: number | null;
  cpl: number | null;
  recommendation: AiAgentRecommendation;
}
```

```ts
type CampaignStateName =
  | "Texas"
  | "Georgia"
  | "Florida"
  | "California"
  | "Mixed"
  | "Sunshine"
  | "Testing";
```

### AI Agent Recommendation

```ts
interface AiAgentRecommendation {
  id: string;
  summary: string;
  priority: RecommendationPriority;
  status?: RecommendationStatus;
  rationale?: string;
  actions: RecommendationAction[];
  confidenceScore?: number | null;
  generatedAt?: string;
}
```

```ts
type RecommendationPriority = "low" | "medium" | "high" | "critical";

type RecommendationStatus =
  | "new"
  | "reviewed"
  | "accepted"
  | "dismissed";
```

```ts
interface RecommendationAction {
  id: string;
  label: string;
  description?: string;
  impact?: string;
}
```

## UI Data Models

The UI can normalize API data into presentation-specific structures.

### KPI Card Data

```ts
interface KpiCardData {
  id: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  status: MetricStatus;
  helperText?: string;
}
```

```ts
type MetricFormat = "currency" | "number" | "percentage";

type MetricStatus = "on-track" | "alert" | "critical";
```

### Table Row Health

```ts
type RowHealth = "met" | "near" | "critical";
```

Recommended mapping:

- `met`: `% Goal >= 1`
- `near`: `% Goal >= 0.8` and `% Goal < 1`
- `critical`: `% Goal < 0.8`, `null`, invalid, or divide-by-zero state

## State Management Approach

Use local React state for the first version.

Recommended local state:

```ts
const [data, setData] = useState<CampaignDashboardApiResponse | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

TanStack Table expanded state should live inside `CampaignStateTable`:

```ts
const [expanded, setExpanded] = useState<ExpandedState>({});
```

Context is not required for the initial implementation because:

- The dashboard is a single page.
- Data ownership is clear at the page level.
- Child components only need read-only props.
- Expanded table row state is local UI state.

Consider React Context or a query/cache layer later if:

- Multiple pages need the same campaign data.
- Filters are shared across distant components.
- Refresh, polling, or optimistic updates become necessary.

## Derived and Computed Fields

The API may provide these values directly, but the UI should be able to derive them defensively when missing.

### `% Spent`

```ts
spentPct = mtdSpent / budget
```

Rules:

- Return `null` if `budget` is `0`, `null`, or missing.
- Format as a percentage.
- Treat `null` as critical for row health only if it affects decision-making.

### `% Goal`

```ts
goalPct = mtdSl / slGoal
```

Rules:

- Return `null` if `slGoal` is `0`, `null`, or missing.
- Format as a percentage.
- Rows with `null` goal percentage should be red/critical.

### `CPSL`

```ts
cpsl = mtdSpent / mtdSl
```

Rules:

- Return `null` if `mtdSl` is `0`, `null`, or missing.
- Format as currency.

### `CPL`

```ts
cpl = mtdSpent / leads
```

Rules:

- Return `null` if `leads` is `0`, `null`, or missing.
- Format as currency.

### `Conversion Rate`

```ts
conversionRate = leads / mtdSl
```

Rules:

- Return `null` if `mtdSl` is `0`, `null`, or missing.
- Format as a percentage.

### `SL % To Target`

```ts
slPctToTarget = sl / slGoal
```

Rules:

- Return `null` if `slGoal` is `0`, `null`, or missing.
- Render gaps in the white percentage line for null values.

## KPI Status Rules

Recommended initial thresholds:

### Completion KPIs

Applies to:

- `% Budget Spent Completion`
- `% SL Goal Completion`
- `% Lead Goal Completion`
- `MTD % Spent`

Rules:

- `on-track`: value is `>= 0.9`
- `alert`: value is `>= 0.75` and `< 0.9`
- `critical`: value is `< 0.75` or `null`

### Cost KPIs

Applies to:

- `final CPL`
- `CPSL`
- `CPQL`

Rules:

- The API should ideally include targets or benchmarks for these metrics.
- If no target exists, render a neutral status or use campaign-defined thresholds.
- For the initial version, allow the page-level mapping function to assign statuses using configurable thresholds.

Suggested future target shape:

```ts
interface CostKpiTarget {
  metric: "finalCpl" | "cpsl" | "cpql";
  onTrackMax: number;
  alertMax: number;
}
```

## Table Columns

Required columns:

- State
- Budget
- SL Goal
- Leads Goal
- MTD Spent
- `% Spent`
- `% Goal`
- CPSL
- MTD SL
- Leads
- Conversion Rate
- CPL

Recommended formatting:

- Currency: `Budget`, `MTD Spent`, `CPSL`, `CPL`
- Whole numbers: `SL Goal`, `Leads Goal`, `MTD SL`, `Leads`
- Percentage: `% Spent`, `% Goal`, `Conversion Rate`

The first column should include an expand/collapse control. The control expands the row to reveal the AI agent recommendation.

## Row Color Coding

Rows should be visually coded using Tailwind classes based on row health.

Recommended states:

- Green for met: `% Goal >= 100%`
- Yellow for near: `% Goal >= 80%` and `< 100%`
- Red for critical: `% Goal < 80%`, `null`, invalid, or divide-by-zero

Invalid spreadsheet-like values such as `#DIV/0!` should not be preserved in normalized data. If the API cannot avoid them, the UI normalization layer should convert them to `null` and mark the row critical.

## Expanded Recommendation Panel

The recommendation panel renders as an additional table row immediately after the expanded campaign row.

Rendering behavior:

- The expanded row should use a single cell with `colSpan` equal to the number of visible table columns.
- The panel should inherit the row context but use a neutral dark or light surface so recommendation text remains readable.
- It should include the recommendation priority, summary, rationale, actions, confidence score, and generated timestamp when available.

Recommended panel content:

```ts
interface RecommendationPanelViewModel {
  stateName: string;
  priorityLabel: string;
  summary: string;
  rationale?: string;
  actions: string[];
  confidenceLabel?: string;
  generatedAtLabel?: string;
}
```

Empty recommendation behavior:

- If a row has no recommendation, render a short empty state inside the expanded panel.
- Do not prevent the row from expanding.

## Loading, Error, and Empty States

### Loading

Show skeleton cards, a chart skeleton, and a table skeleton while data is loading.

### Error

Show a dashboard-level error panel with:

- A short message
- Optional retry action
- No raw stack trace

### Empty

If the API returns no state campaigns:

- Render KPI cards if available.
- Render an empty table state.
- Render an empty chart state if monthly data is also missing.

## Formatting Utilities

The implementation should use small reusable formatting helpers:

```ts
type NullableNumber = number | null | undefined;
```

Recommended helpers:

- `formatCurrency(value: NullableNumber): string`
- `formatNumber(value: NullableNumber): string`
- `formatPercentage(value: NullableNumber): string`
- `formatMonth(value: string): string`
- `safeDivide(numerator: NullableNumber, denominator: NullableNumber): number | null`

Formatting rules:

- `null` and invalid values render as `-`.
- Percentages render as `85%` or `85.4%` depending on precision needs.
- Currency renders in USD unless the API later includes currency metadata.

## Accessibility Requirements

- KPI status indicators must not rely on color alone; include readable labels.
- Table expand/collapse controls must have accessible labels.
- Chart colors should have sufficient contrast against the dark background.
- Tooltips should be readable with keyboard/mouse interaction where Recharts supports it.
- Table headers should use semantic `th` elements via TanStack rendering.

## Styling Direction

Use a work-focused dashboard style:

- Compact spacing
- Clear hierarchy
- Dark chart panel
- Neutral page background
- Status colors reserved for meaning
- No decorative hero layout
- No marketing-style cards beyond actual KPI metric cards

Suggested Tailwind color semantics:

- Page background: neutral light
- Cards/table surface: white
- Chart panel: neutral near-black
- Actual SL bars: green
- Goal line: blue
- Percentage line: white
- On-track: green
- Alert/near: yellow
- Critical: red

## Implementation Notes for Future Build

- Keep API fetching in `DashboardPage` for the initial version.
- Keep chart and table components presentation-focused.
- Normalize API values before passing rows into the table.
- Avoid storing derived values in multiple places unless they come directly from the API.
- Prefer memoized column definitions for TanStack Table.
- Prefer memoized derived KPI card models and table row health values.
- Do not implement global state until more pages or shared filters exist.

## Implementation Log

- `src/utils/dashboardFormatters.ts` - Provides shared currency, number, percentage, month, and safe division helpers.
- `src/types/dashboard.ts` - Defines the dashboard API, component prop, KPI, table, recommendation, and utility TypeScript types.
- `src/components/dashboard/KpiCard.tsx` - Renders a single aggregate KPI metric card with formatted value and visible status label.
- `src/components/dashboard/KpiCardsGrid.tsx` - Renders the responsive KPI cards row.
- `src/components/dashboard/CampaignPerformanceChart.tsx` - Renders the Recharts composed chart with SL bars, SL Goal line, and SL percentage line.
- `src/components/dashboard/RecommendationPanel.tsx` - Renders AI recommendation details inside an expanded table row.
- `src/components/dashboard/CampaignStateTable.tsx` - Renders the TanStack Table state rows, row health coloring, and expandable recommendation rows.
- `src/components/dashboard/DashboardHeader.tsx` - Renders the dashboard title, subtitle, and optional last updated timestamp.
- `src/components/dashboard/BrandFilter.tsx` - Renders the static brand selector and calls the brand change callback.
- `src/components/dashboard/DashboardPage.tsx` - Fetches live dashboard API data, normalizes metrics, builds KPI card data, and composes the dashboard sections.
- `tailwind.config.ts` - Configures Tailwind content scanning for the app and dashboard source files.
- `postcss.config.mjs` - Enables Tailwind and Autoprefixer processing for the Next.js app.
