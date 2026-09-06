import { Card, CardTitle, cn, formatNumber } from "./ui";

export function PopularTypes({
  types,
}: {
  types: Array<{ name: string; count: number }>;
}) {
  const max = Math.max(1, ...types.map((t) => t.count));
  return (
    <Card className="p-5">
      <CardTitle>Popular booking types</CardTitle>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Most-booked services in this range
      </p>
      <ul className="mt-4 space-y-3">
        {types.map((t, i) => (
          <li key={t.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-foreground">
                {t.name}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {formatNumber(t.count)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  i === 0 ? "bg-primary" : "bg-indigo-300",
                )}
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatHour(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${ampm}`;
}

export function PopularTimes({
  times,
}: {
  times: Array<{ hour: number; count: number }>;
}) {
  const max = Math.max(1, ...times.map((t) => t.count));
  const peak = times.reduce((a, b) => (b.count > a.count ? b : a), times[0]);
  return (
    <Card className="p-5">
      <CardTitle>Popular booking times</CardTitle>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Peak demand: <span className="font-semibold text-foreground">{formatHour(peak.hour)}</span>
      </p>
      <div className="mt-4 flex h-28 items-end gap-2">
        {times.map((t) => (
          <div key={t.hour} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn(
                "w-full rounded-t-[3px]",
                t.hour === peak.hour ? "bg-primary" : "bg-indigo-200",
              )}
              style={{ height: `${Math.max(4, (t.count / max) * 100)}%` }}
              title={`${formatHour(t.hour)}: ${t.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {times.map((t) => (
          <div
            key={t.hour}
            className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {formatHour(t.hour)}
          </div>
        ))}
      </div>
    </Card>
  );
}
