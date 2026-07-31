"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Connection = {
  id: string;
  name: string;
  provider: string;
  status: string;
};

type Slot = { startsAt: string; endsAt: string };

export default function VoiceCalendarsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("Main calendar");
  const [provider, setProvider] = useState("internal");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookSlot, setBookSlot] = useState("");
  const [bookPhone, setBookPhone] = useState("+14155550199");
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/voice/calendars").then((r) => r.json()).then((j) => setConnections(j.data || []));
  }

  useEffect(() => {
    load();
    const oauth = searchParams.get("oauth");
    const err = searchParams.get("oauth_error");
    if (oauth) setNotice(`Calendar connected (${oauth})`);
    if (err) setNotice(`OAuth error: ${err}`);
  }, [searchParams]);

  async function create() {
    const res = await fetch("/api/voice/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, provider }),
    });
    const json = await res.json();
    load();
    const conn = json.data;
    if (conn?.provider === "google") {
      window.location.href = `/api/voice/calendars/oauth/google?connectionId=${conn.id}`;
    } else if (conn?.provider === "microsoft") {
      window.location.href = `/api/voice/calendars/oauth/microsoft?connectionId=${conn.id}`;
    }
  }

  async function loadAvailability() {
    const res = await fetch("/api/voice/calendars/availability?days=5");
    const json = await res.json();
    setSlots(json.data?.slots || []);
  }

  async function book() {
    const res = await fetch("/api/voice/calendars/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "book",
        startsAt: bookSlot,
        phone: bookPhone,
        serviceName: "Appointment",
      }),
    });
    const json = await res.json();
    setNotice(json.error || `Booked: ${json.data?.appointmentId || "ok"}`);
    loadAvailability();
  }

  return (
    <div>
      <PageHeader
        title="Calendars"
        description="Calendar connections, services, staff, and booking rules for live appointment scheduling."
      />
      <VoiceSubNav />
      {notice && <p className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-4">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Provider</Label>
          <select
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="internal">Internal scheduler</option>
            <option value="google">Google Calendar</option>
            <option value="microsoft">Outlook / Microsoft</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={create}><Plus className="h-4 w-4" /> Connect</Button>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={loadAvailability}>Load availability</Button>
        </div>
      </Card>

      <Card className="mb-6 overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Provider</TH><TH>Status</TH></TR></THead>
          <TBody>
            {connections.map((c) => (
              <TR key={c.id}>
                <TD>{c.name}</TD>
                <TD>{c.provider}</TD>
                <TD><StatusChip status={c.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {slots.length > 0 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Available slots</h2>
          <select
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={bookSlot}
            onChange={(e) => setBookSlot(e.target.value)}
          >
            <option value="">Select slot</option>
            {slots.map((s) => (
              <option key={s.startsAt} value={s.startsAt}>
                {new Date(s.startsAt).toLocaleString()}
              </option>
            ))}
          </select>
          <div>
            <Label>Phone</Label>
            <Input value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} />
          </div>
          <Button onClick={book} disabled={!bookSlot}>Book appointment</Button>
        </Card>
      )}
    </div>
  );
}
