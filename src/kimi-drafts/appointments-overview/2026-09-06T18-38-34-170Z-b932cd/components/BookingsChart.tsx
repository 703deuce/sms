import { BarChart3 } from "lucide-react";

type ChartModel = {
  points: number[];
  days: string[];
  total: number;
  deltaLabel: string;
  peakLabel: string;
  vsLastWeek: string;
};

export default function BookingsChart({ chart }: { chart: ChartModel }) {
  const max = Math.max(...chart.points, 1);
  const empty = chart.total === 0;
  return (
    <section className="ref-card flex flex-col">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Bookings this week</h2>
        <span className={`ref-chip ${empty ? "ref-chip-gray" : "ref-chip-green"}`}>{chart.vsLastWeek}</span>
      </div>
      {empty ? (
        <div className="ref-empty flex-1">
          <span className="ref-tint-blue flex h-11 w-11 items-center justify-center rounded-xl">
            <BarChart3 size={18} />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-gray-900">No bookings yet</h3>
          <p className="mt-1 max-w-[260px] text-[12.5px] text-gray-500">
            Once customers start booking, you&apos;ll see weekly booking trends here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-end gap-2.5 px-[18px] pt-6">
            {chart.points.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-500">{v}</span>
                <div
                  className="w-full rounded-t-md bg-indigo-500/90"
                  style={{ height: `${Math.max((v / max) * 120, 4)}px` }}
                />
                <span className="text-[11px] text-gray-400">{chart.days[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 px-[18px] py-3">
            <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <BarChart3 size={13} className="text-indigo-500" /> Peak: {chart.peakLabel}
            </span>
            <span className="text-[12px] font-medium text-gray-700">{chart.deltaLabel}</span>
          </div>
        </>
      )}
    </section>
  );
}
