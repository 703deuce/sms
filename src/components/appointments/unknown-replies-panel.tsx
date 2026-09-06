"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type UnknownReply = {
  appointmentId: string;
  serviceName: string;
  startsAt: string;
  status: string;
  replyBody: string;
  repliedAt: string;
};

export function UnknownRepliesPanel() {
  const [items, setItems] = useState<UnknownReply[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/workflows/unknown-replies");
    if (res.ok) {
      const json = await res.json();
      setItems(json.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function clearReply(appointmentId: string) {
    await fetch("/api/appointments/workflows/unknown-replies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, action: "clear" }),
    });
    setItems((prev) => prev.filter((i) => i.appointmentId !== appointmentId));
  }

  return (
    <Card className="p-5">
      <CardTitle className="mb-3">Unknown SMS replies</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Customer replies that did not match confirm, cancel, or reschedule keywords.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unknown replies recorded.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.appointmentId} className="rounded-lg border px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.startsAt).toLocaleString()} · {item.status}
                  </p>
                  <p className="mt-2 rounded bg-muted/60 px-2 py-1.5 text-[13px]">{item.replyBody}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Received {new Date(item.repliedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/appointments/${item.appointmentId}`}>View</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => clearReply(item.appointmentId)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
