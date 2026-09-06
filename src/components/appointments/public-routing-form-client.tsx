"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PublicBookingClient } from "@/components/appointments/public-booking-client";

type Props = {
  workspaceSlug: string;
  formSlug: string;
};

export function PublicRoutingFormClient({ workspaceSlug, formSlug }: Props) {
  const [form, setForm] = useState<{
    id: string;
    name: string;
    headline?: string;
    fields: Array<{ id: string; label: string; type: string; options?: string[]; required?: boolean }>;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/routing/${workspaceSlug}`)
      .then((r) => r.json())
      .then((json) => {
        const match = (json.data || []).find((f: { slug: string }) => f.slug === formSlug);
        setForm(match || null);
      })
      .finally(() => setLoading(false));
  }, [workspaceSlug, formSlug]);

  async function submit() {
    if (!form) return;
    const res = await fetch(`/api/public/routing/${workspaceSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: form.id, answers }),
    });
    const json = await res.json();
    setDestination(json.data?.destination || null);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!form) return <div className="p-8 text-center">Form not found</div>;

  if (destination?.externalUrl) {
    window.location.href = String(destination.externalUrl);
    return <div className="p-8 text-center">Redirecting…</div>;
  }

  if (destination?.appointmentTypeId) {
    return (
      <PublicBookingClient
        slug={workspaceSlug}
        preselectTypeId={String(destination.appointmentTypeId)}
        embed
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <Card className="mx-auto max-w-lg p-6">
        <CardTitle className="mb-4">{form.headline || form.name}</CardTitle>
        <div className="space-y-4">
          {form.fields.map((field) => (
            <div key={field.id}>
              <label className="text-sm font-medium">{field.label}</label>
              {field.type === "select" ? (
                <select
                  className="input w-full mt-1"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                >
                  <option value="">Select…</option>
                  {(field.options || []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input w-full mt-1"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                />
              )}
            </div>
          ))}
          <Button className="w-full" onClick={submit}>Continue</Button>
        </div>
      </Card>
    </div>
  );
}
