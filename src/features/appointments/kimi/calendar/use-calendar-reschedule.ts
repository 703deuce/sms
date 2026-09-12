"use client";

import { useCallback, useState } from "react";
import type { RecurringEditScope } from "@/lib/appointments/service-booking/types";

type PendingReschedule = {
  appointmentId: string;
  startsAt: string;
};

export function useCalendarReschedule(onRefresh: () => void) {
  const [dragOverrides, setDragOverrides] = useState<Record<string, { day: number; start: number }>>({});
  const [pending, setPending] = useState<PendingReschedule | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const clearDrag = useCallback((id: string) => {
    setDragOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const onDragPreview = useCallback((input: { id: string; day: number; start: number }) => {
    setDragOverrides((prev) => ({ ...prev, [input.id]: { day: input.day, start: input.start } }));
  }, []);

  const commitReschedule = useCallback(
    async (appointmentId: string, startsAt: string, recurringScope?: RecurringEditScope) => {
      try {
        const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startsAt,
            ...(recurringScope ? { recurringScope } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not reschedule");
        clearDrag(appointmentId);
        onRefresh();
        setToast(null);
      } catch (e) {
        clearDrag(appointmentId);
        const msg = e instanceof Error ? e.message : "Reschedule failed";
        setToast(msg);
      } finally {
        setPending(null);
        setRecurringOpen(false);
      }
    },
    [clearDrag, onRefresh],
  );

  const beginReschedule = useCallback(
    async (appointmentId: string, startsAt: string, recurringSeriesId?: string) => {
      if (recurringSeriesId) {
        setPending({ appointmentId, startsAt });
        setRecurringOpen(true);
        return;
      }
      await commitReschedule(appointmentId, startsAt);
    },
    [commitReschedule],
  );

  const onDragCommit = useCallback(
    (input: { id: string; startsAt: string }, recurringSeriesId?: string) => {
      void beginReschedule(input.id, input.startsAt, recurringSeriesId);
    },
    [beginReschedule],
  ) as (input: { id: string; startsAt: string }, recurringSeriesId?: string) => void;

  const confirmRecurring = useCallback(
    (scope: RecurringEditScope) => {
      if (!pending) return;
      void commitReschedule(pending.appointmentId, pending.startsAt, scope);
    },
    [commitReschedule, pending],
  );

  return {
    dragOverrides,
    onDragPreview,
    onDragClear: clearDrag,
    onDragCommit,
    beginReschedule,
    pending,
    recurringOpen,
    setRecurringOpen,
    confirmRecurring,
    toast,
    setToast,
  };
}
