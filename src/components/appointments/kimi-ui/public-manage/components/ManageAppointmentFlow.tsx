"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Link2Off } from "lucide-react";
import { PublicShell } from "@/components/appointments/kimi-ui/public-reschedule/components/PublicShell";
import {
  Button,
  Card,
  formatWhen,
  Spinner,
} from "@/components/appointments/kimi-ui/public-reschedule/components/ui";

type ManagePayload = {
  serviceName: string | null;
  startsAt: string;
  endsAt?: string;
  timezone?: string | null;
  businessName?: string;
  status: string;
  actions?: { reschedule?: string | null; cancel?: string | null };
};

export function ManageAppointmentFlow({ token, live = false }: { token: string; live?: boolean }) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">("loading");
  const [data, setData] = useState<ManagePayload | null>(null);

  useEffect(() => {
    if (!live || !token) return;
    setLoadState("loading");
    fetch(`/api/public/appointments/manage/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((json) => {
        setData(json.data as ManagePayload);
        setLoadState("ready");
      })
      .catch(() => setLoadState("invalid"));
  }, [live, token]);

  if (loadState === "loading") {
    return (
      <PublicShell>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24 }}>
          <Spinner />
          <span>Loading your appointment…</span>
        </div>
      </PublicShell>
    );
  }

  if (loadState === "invalid" || !data) {
    return (
      <PublicShell>
        <Card style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <Link2Off style={{ margin: "0 auto 12px" }} aria-hidden />
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>This link is invalid or expired</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)" }}>
            Contact the business directly if you need to change your appointment.
          </p>
        </Card>
      </PublicShell>
    );
  }

  const when = formatWhen(data.startsAt, data.timezone || undefined);
  const canceled = /cancel/i.test(data.status);

  return (
    <PublicShell>
      <Card style={{ width: "100%", maxWidth: 440, padding: "24px 20px" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
          {data.businessName || "Your appointment"}
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {data.serviceName || "Appointment"}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 20 }}>{when}</p>

        {canceled ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>This appointment is canceled.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.actions?.reschedule ? (
              <Link href={data.actions.reschedule} style={{ textDecoration: "none" }}>
                <Button fullWidth variant="primary" type="button">
                  <CalendarClock size={18} aria-hidden />
                  Reschedule
                </Button>
              </Link>
            ) : null}
            {data.actions?.cancel ? (
              <Link href={data.actions.cancel} style={{ textDecoration: "none" }}>
                <Button fullWidth variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </PublicShell>
  );
}
