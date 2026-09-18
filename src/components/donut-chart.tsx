"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DonutSegment = {
  key: string;
  label: string;
  color: string;
  count: number;
};

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 80;
const STROKE = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_PX = 3;

/**
 * A part-to-whole donut for an "at a glance" impression (see the
 * dataviz skill: donut is fine for <=6-8 segments read quickly, not
 * for judging close values precisely — a table/legend rides alongside
 * for that, which also satisfies the palette's contrast "relief" rule
 * for the lighter slots.
 */
export function DonutChart({ segments, title }: { segments: DonutSegment[]; title: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const nonZero = segments.filter((s) => s.count > 0);

  const arcs = nonZero.reduce<{ cumulative: number; rows: Array<DonutSegment & { length: number; offset: number; fraction: number }> }>(
    (acc, s) => {
      const fraction = total > 0 ? s.count / total : 0;
      const rawLength = fraction * CIRCUMFERENCE;
      const length = Math.max(rawLength - GAP_PX, 0);
      acc.rows.push({ ...s, length, offset: -acc.cumulative, fraction });
      return { cumulative: acc.cumulative + rawLength, rows: acc.rows };
    },
    { cumulative: 0, rows: [] }
  ).rows;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
          />
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={hovered === arc.key ? STROKE + 4 : STROKE}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                className="transition-[stroke-width] duration-150"
                onMouseEnter={() => setHovered(arc.key)}
                onMouseLeave={() => setHovered((h) => (h === arc.key ? null : h))}
              >
                <title>
                  {arc.label}: {arc.count} ({Math.round(arc.fraction * 100)}%)
                </title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold leading-none">{total}</span>
          <span className="text-xs text-muted-foreground">total</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-1.5">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No interactions logged in this period.</p>
        ) : (
          segments.map((s) => (
            <div
              key={s.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm transition-colors",
                hovered === s.key ? "bg-muted" : ""
              )}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered((h) => (h === s.key ? null : h))}
            >
              <span className="flex items-center gap-2 text-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {s.label}
              </span>
              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                {s.count} {total > 0 ? `(${Math.round((s.count / total) * 100)}%)` : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
