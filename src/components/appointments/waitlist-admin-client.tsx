"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type WaitlistEntry = {
  id: string;
  serviceName: string | null;
  phone: string | null;
  email: string | null;
  preferredDate?: string | null;
  status: string;
  createdAt: string;
};

export function WaitlistAdminClient() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/appointments/waitlist")
      .then((r) => r.json())
      .then((j) => setEntries(j.data || []))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchEntry(entryId: string, action: "notify" | "remove" | "reactivate") {
    setActing(entryId);
    await fetch("/api/appointments/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, action }),
    });
    setActing(null);
    load();
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold mb-6">Waitlist</h1>
      {entries.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No waitlist entries. Entries appear when customers join from the booking page.
        </Card>
      ) : (
        entries.map((e) => (
          <Card key={e.id} className="p-4 mb-3 flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">{e.serviceName || "Any service"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {e.phone || e.email || "No contact"} · {e.status}
                {e.preferredDate ? ` · prefers ${e.preferredDate}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Joined {new Date(e.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === e.id}
                  onClick={() => patchEntry(e.id, "notify")}
                >
                  Notify
                </Button>
              ) : null}
              {e.status !== "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === e.id}
                  onClick={() => patchEntry(e.id, "reactivate")}
                >
                  Reactivate
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600"
                disabled={acting === e.id}
                onClick={() => patchEntry(e.id, "remove")}
              >
                Remove
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
