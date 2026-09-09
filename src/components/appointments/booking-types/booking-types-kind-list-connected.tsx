"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  segmentById,
  typeBelongsToSegment,
  type ApiTypeRow,
  type BookingTypesSegmentId,
} from "@/lib/appointments/booking-types-segments";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Props = {
  segmentId: BookingTypesSegmentId;
};

export function BookingTypesKindListConnected({ segmentId }: Props) {
  const segment = segmentById(segmentId);
  const [rows, setRows] = useState<ApiTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/appointments/types");
      if (!res.ok) throw new Error("types failed");
      const json = await res.json();
      setRows((json.data || []) as ApiTypeRow[]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => typeBelongsToSegment(r, segmentId)),
    [rows, segmentId],
  );

  const activeCount = filtered.filter((r) => r.config?.enabled !== false && r.active !== false).length;

  if (loading) {
    return (
      <div className="ref-root min-h-full bg-[#f7f8fb] px-6 pb-8 pt-5 font-sans animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="mt-6 h-64 rounded-xl bg-white border border-[#ecedf2]" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="ref-root min-h-full bg-[#f7f8fb] px-6 py-12 font-sans flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-indigo-600" />
          <p className="mt-3 text-sm font-semibold text-gray-900">Could not load {segment.title.toLowerCase()}</p>
          <Button size="sm" className="mt-5" onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ref-root min-h-full bg-[#f7f8fb] px-6 pb-10 pt-5 font-sans">
      <Link
        href="/appointments/types"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5b4bff] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b4bff]"
      >
        <ArrowLeft size={14} aria-hidden />
        Booking Types
      </Link>

      <RefDecoPageHeader
        title={segment.title}
        description={segment.description}
        action={
          <Link
            href={segment.createHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#5b4bff] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#4f41e6]"
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden />
            {segmentId === "workshops" ? "Create workshop or event" : `Create ${segment.title.toLowerCase().replace(/s$/, "")}`}
          </Link>
        }
      />

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e4e6ee] bg-white px-6 py-12 text-center">
          <h2 className="text-[15px] font-semibold text-[#1a1d29]">
            {segmentId === "meetings"
              ? "Create your first meeting"
              : segmentId === "services"
                ? "Create your first service"
                : segmentId === "classes"
                  ? "Create your first class"
                  : "Create your first workshop or event"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#6b7280]">{segment.description}</p>
          <Link
            href={segment.createHref}
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#5b4bff] px-4 text-[13px] font-semibold text-white"
          >
            {segmentId === "workshops" ? "Create workshop or event" : `Create ${segment.title.toLowerCase().replace(/s$/, "")}`}
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#e8eaef] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-[#f0f1f5] px-4 py-3 text-[12px] font-medium text-[#8a8fa3]">
            {activeCount} active · {filtered.length} total
          </div>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f0f1f5] text-[12px] text-[#8a8fa3]">
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const duration = row.durationMinutes;
                const active = row.config?.enabled !== false && row.active !== false;
                return (
                  <tr key={row.id} className="border-b border-[#f0f1f5] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1a1d29]">{row.name}</td>
                    <td className="px-4 py-3 text-[#6b7280]">{duration ? `${duration} min` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={active ? "text-emerald-700" : "text-[#8a8fa3]"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/appointments/types/editor?id=${encodeURIComponent(row.id)}`}
                        className="font-medium text-[#5b4bff] hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] text-[#8a8fa3]">
        Transitional list — focused {segment.title.toLowerCase()} editor ships in the next batch.
      </p>
    </div>
  );
}
