"use client";

import { useEffect, useState } from "react";
import { PublicBookingClient } from "@/components/appointments/public-booking-client";
import { Card, CardTitle } from "@/components/ui/card";

type Props = { workspaceSlug: string; pageSlug: string };

export function PublicTeamBookClient({ workspaceSlug, pageSlug }: Props) {
  const [data, setData] = useState<{
    teamPage: { name: string; headline?: string; appointmentTypeIds: string[] };
    types: Array<{ id: string; name: string }>;
  } | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/team-book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(pageSlug)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setData(json.data);
          const first = json.data.types?.[0]?.id;
          if (first) setSelectedType(first);
        }
      });
  }, [workspaceSlug, pageSlug]);

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (selectedType) {
    return (
      <PublicBookingClient
        slug={workspaceSlug}
        preselectTypeId={selectedType}
        embed
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <Card className="mx-auto max-w-lg p-6">
        <CardTitle>{data.teamPage.headline || data.teamPage.name}</CardTitle>
        <div className="mt-4 space-y-2">
          {data.types.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full rounded-lg border px-4 py-3 text-left hover:bg-muted"
              onClick={() => setSelectedType(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
