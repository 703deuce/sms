import { useMemo, useState } from "react";
import { Card, CardTitle, cn, formatNumber } from "./ui";

function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BookingsChart({
  series,
  rangeDays,
}: {
  series: Array<{ date: string; count: number }>;
  rangeDays: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(
    () => Math.max(1, ...series.map((p) => p.count)),
    [series],
  );
  const total = useMemo(
    () => series.reduce((acc, p) => acc + p.count, 0),
    [series],
  );
  const labelEvery = rangeDays === 30 ? 5 : 1;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <CardTitle>Bookings</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Appointments booked per day · last {rangeDays} days
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground">
          {formatNumber(total)}{" "}
          <span className="text-xs font-medium text-muted-foreground">total</span>
        </p>
      </div>

      <div className="relative mt-5">
        {hover != null && series[hover] ? (
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm">
            {formatSeriesDate(series[hover].date)} · {series[hover].count} booked
          </div>
        ) : null}
        <div className="flex h-44 items-end gap-[3px]">
          {series.map((p, i) => (
            <button
              key={p.date}
              type="button"
              aria-label={`${formatSeriesDate(p.date)}: ${p.count} bookings`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group flex h-full flex-1 items-end rounded-sm focus:outline-none"
            >
              <div
                className={cn(
                  "chart-bar w-full rounded-t-[3px]",
                  hover === i ? "bg-primary" : "bg-indigo-200",
                )}
                style={{ height: `${Math.max(3, (p.count / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-[3px]">
          {series.map((p, i) => (
            <div key={p.date} className="flex-1 text-center">
              {i % labelEvery === 0 ? (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {formatSeriesDate(p.date)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
