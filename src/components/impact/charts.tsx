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
          return (
            <div key={d.label} title={tip} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
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
            </div>
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
}: {
  color: string;
  label: string;
  value: string;
  detail: string;
  current: number;
  previous: number | null;
  periodWord: string | null;
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
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
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
    </div>
  );
}
