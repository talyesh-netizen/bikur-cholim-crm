import type { MonthlyCount } from "@/lib/queries/impact";

const WIDTH = 480;
const HEIGHT = 160;
const BAR_GAP = 12;
const LABEL_HEIGHT = 24;

/**
 * A single-series month-over-month bar chart -- for "is our activity
 * growing" at a glance, separate from the type/staff/volunteer
 * breakdowns. One hue (the brand primary), direct-labeled since there
 * are only a handful of bars, per the dataviz skill's guidance for a
 * single magnitude-over-time series (no legend needed -- the title
 * names the series).
 */
export function TrendChart({ data, title }: { data: MonthlyCount[]; title: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const plotHeight = HEIGHT - LABEL_HEIGHT;
  const barWidth = (WIDTH - BAR_GAP * (data.length - 1)) / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title} className="max-w-full">
      {data.map((d, i) => {
        const barHeight = (d.count / max) * (plotHeight - 20);
        const x = i * (barWidth + BAR_GAP);
        const y = plotHeight - barHeight;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={4} className="fill-primary">
              {/* One plain string -- see the note in donut-chart.tsx. */}
              <title>{`${d.label}: ${d.count} interaction${d.count === 1 ? "" : "s"}`}</title>
            </rect>
            {d.count > 0 ? (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-foreground text-[11px] tabular-nums"
              >
                {d.count}
              </text>
            ) : null}
            <text
              x={x + barWidth / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={plotHeight} x2={WIDTH} y2={plotHeight} className="stroke-border" strokeWidth={1} />
    </svg>
  );
}
