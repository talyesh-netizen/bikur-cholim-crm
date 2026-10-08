import Link from "next/link";
import type { LabeledValue, MonthBar } from "@/lib/queries/impact-overview";

/** Section colors -- the same ones the Impact donut uses for these kinds
 * of work, so a color always means the same thing across the app. */
export const SERIES = {
  residents: "#2a78d6",
  volunteers: "#eb6834",
  families: "#e87ba4",
  staff: "#eb6834",
  reached: "#1baf7a",
} as const;

const BAR_AREA = 150; // px

/** A titled white card holding one chart. */
export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <figcaption className="flex flex-col gap-1">
        <span className="text-base font-semibold">{title}</span>
        {subtitle ? <span className="text-sm text-muted-foreground">{subtitle}</span> : null}
      </figcaption>
      {children}
    </figure>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Vertical bars per month; with two colors the bars stack (first color
 * at the bottom). Each column shows its total on top and its parts on hover. */
export function MonthBars({ data, colors, names }: { data: MonthBar[]; colors: string[]; names: string[] }) {
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-[190px] items-end gap-3 border-b border-border px-1">
        {data.map((d) => {
          const total = d.values.reduce((a, b) => a + b, 0);
          const tip = `${d.label}: ${d.values.map((v, i) => `${v} ${names[i]}`).join(", ")}`;
          const Column = d.href ? Link : "div";
          return (
            <Column
              key={d.label}
              href={d.href as string}
              title={d.href ? `${tip} -- tap to see them` : tip}
              className={`flex h-full flex-1 flex-col items-center justify-end gap-1.5${d.href ? " rounded-t-md hover:bg-muted/60" : ""}`}
            >
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{total}</span>
              <div className="flex w-full max-w-[46px] flex-col-reverse gap-[2px]">
                {d.values.map((v, i) =>
                  v > 0 ? (
                    <div
                      key={i}
                      style={{
                        height: Math.max(2, Math.round((v / max) * BAR_AREA)),
                        backgroundColor: colors[i],
                        borderRadius: i === d.values.length - 1 || d.values.slice(i + 1).every((x) => x === 0) ? "4px 4px 0 0" : 0,
                      }}
                    />
                  ) : null
                )}
              </div>
            </Column>
          );
        })}
      </div>
      <div className="flex gap-3 px-1">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-xs text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars with a label and the number beside each. */
export function HBars({ data, color, labelWidth = 130 }: { data: LabeledValue[]; color: string; labelWidth?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => {
        const bar = (
          <div
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px minmax(0, 1fr) 40px` }}
            title={`${d.label}: ${d.value}`}
          >
            <span className="truncate text-sm">{d.label}</span>
            <div className="h-5 rounded bg-muted">
              <div className="h-5 rounded-r" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color }} />
            </div>
            <span className="text-right text-sm font-semibold tabular-nums">{d.value}</span>
          </div>
        );
        return d.href ? (
          <Link key={d.label} href={d.href} className="-mx-2 rounded-md px-2 py-0.5 hover:bg-muted/60">
            {bar}
          </Link>
        ) : (
          <div key={d.label}>{bar}</div>
        );
      })}
    </div>
  );
}

/** One bar split into parts (e.g. facilities by relationship stage), with
 * a legend that carries the numbers. */
export function SplitBar({ data }: { data: LabeledValue[] }) {
  const total = Math.max(1, data.reduce((a, d) => a + d.value, 0));
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-7 gap-[2px]" role="img" aria-label={data.map((d) => `${d.value} ${d.label}`).join(", ")}>
        {visible.map((d, i) => (
          <div
            key={d.label}
            title={`${d.label}: ${d.value}`}
            style={{
              width: `${(d.value / total) * 100}%`,
              backgroundColor: d.color,
              borderRadius:
                visible.length === 1 ? 4 : i === 0 ? "4px 0 0 4px" : i === visible.length - 1 ? "0 4px 4px 0" : 0,
            }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
              {d.label}
            </span>
            <strong className="tabular-nums">{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A headline number with an optional comparison to the previous period. */
export function HeadlineTile({
  color,
  label,
  value,
  detail,
  current,
  previous,
  periodWord,
  href,
}: {
  color: string;
  label: string;
  value: string;
  detail: string;
  current: number;
  previous: number | null;
  periodWord: string | null;
  /** Where tapping the tile goes -- the entries behind the number. */
  href?: string;
}) {
  let change: { text: string; good: boolean } | null = null;
  if (previous !== null && periodWord) {
    if (previous === 0) change = current > 0 ? { text: `New this ${periodWord}`, good: true } : null;
    else {
      const pct = Math.round(((current - previous) / previous) * 100);
      change =
        pct === 0
          ? { text: `Same as last ${periodWord}`, good: false }
          : { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs last ${periodWord}`, good: pct > 0 };
    }
  }
  const Tile = href ? Link : "div";
  return (
    <Tile
      href={href as string}
      className={`flex flex-col gap-2 rounded-xl border border-border bg-card p-5${href ? " transition-colors hover:border-foreground/30 hover:bg-muted/40" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <p className="m-0 text-4xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="m-0 text-sm text-muted-foreground">{detail}</p>
      {change ? (
        <p className={change.good ? "m-0 text-xs font-semibold text-tone-good-fg" : "m-0 text-xs font-semibold text-muted-foreground"}>
          {change.text}
        </p>
      ) : null}
      {href ? <p className="m-0 mt-auto text-xs font-medium text-muted-foreground">See the latest →</p> : null}
    </Tile>
  );
}

/** A percentage over time as a 2px line with point markers, plus an
 * optional dashed goal line. The line is SVG (stretched to fit); markers
 * and labels are HTML so they never distort. Hover a point for its
 * numbers. One series, so no legend -- the card title names it. */
export function PercentLine({
  data,
  color,
  goal,
  goalLabel,
}: {
  data: { label: string; percent: number; detail: string }[];
  color: string;
  goal?: number;
  goalLabel?: string;
}) {
  const top = Math.min(100, Math.max(10, Math.ceil((Math.max(goal ?? 0, ...data.map((d) => d.percent)) + 5) / 10) * 10));
  const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;
  const gridSteps = [0, top / 2, top];
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[190px] border-b border-border">
        {gridSteps.map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: `${y(g)}%` }}>
            <span className="-mt-2.5 w-9 text-xs text-muted-foreground tabular-nums">{Math.round(g)}%</span>
            {g > 0 ? <span className="h-px flex-1 bg-border/60" /> : null}
          </div>
        ))}
        <div className="absolute inset-y-0 left-10 right-3">
          {goal !== undefined ? (
            <div className="pointer-events-none absolute inset-x-0" style={{ top: `${y(goal)}%` }}>
              <div className="border-t-2 border-dashed border-foreground/50" />
              <span className="absolute left-0 -top-5 rounded bg-card px-1 text-xs font-semibold text-foreground">
                {goalLabel ?? `Goal ${goal}%`}
              </span>
            </div>
          ) : null}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline
              points={data.map((d, i) => `${x(i)},${y(d.percent)}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {data.map((d, i) => (
            <div
              key={d.label}
              title={`${d.label}: ${d.percent}% (${d.detail})`}
              className="group absolute -translate-x-1/2 -translate-y-1/2 p-2"
              style={{ left: `${x(i)}%`, top: `${y(d.percent)}%` }}
            >
              <span className="block size-2.5 rounded-full ring-2 ring-card" style={{ backgroundColor: color }} />
              {i === data.length - 1 ? (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground tabular-nums">
                  {d.percent}%
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="relative ml-10 mr-3 h-4">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={`absolute -translate-x-1/2 text-xs text-muted-foreground ${i % 2 === 1 && data.length > 7 ? "max-sm:invisible" : ""}`}
            style={{ left: `${x(i)}%` }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
