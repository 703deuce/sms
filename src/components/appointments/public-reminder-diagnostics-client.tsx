"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function PublicReminderDiagnosticsClient({ slug }: { slug: string }) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<{
    found: boolean;
    appointment?: { serviceName: string; startsAt: string; status: string; remindersSuppressed: boolean };
    upcomingReminders?: Array<{ label: string; scheduledFor: string; status: string }>;
    reminderHistory?: Array<{ label: string; at: string }>;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    const params = new URLSearchParams();
    if (phone) params.set("phone", phone);
    if (email) params.set("email", email);
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/reminder-diagnostics?${params}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <Card className="mx-auto max-w-lg p-6 space-y-4">
        <h1 className="font-display text-xl font-semibold">Reminder status</h1>
        <p className="text-sm text-muted-foreground">Check upcoming reminders for your appointment.</p>
        <div>
          <Label>Phone</Label>
          <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button onClick={lookup} disabled={loading || (!phone && !email)}>
          {loading ? "Looking up…" : "Check reminders"}
        </Button>
        {data ? (
          <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
            {!data.found ? (
              <p>{data.message}</p>
            ) : (
              <>
                <p className="font-medium">{data.appointment?.serviceName}</p>
                <p>{data.appointment?.startsAt ? new Date(data.appointment.startsAt).toLocaleString() : ""}</p>
                {data.appointment?.remindersSuppressed ? (
                  <p className="text-amber-700">Reminders are suppressed for this appointment.</p>
                ) : null}
                {data.upcomingReminders?.length ? (
                  <div>
                    <p className="font-semibold mt-2">Upcoming</p>
                    <ul className="list-disc pl-4">
                      {data.upcomingReminders.map((r) => (
                        <li key={r.label}>{r.label} — {new Date(r.scheduledFor).toLocaleString()}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
