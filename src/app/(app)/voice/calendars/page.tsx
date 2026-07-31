"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Connection = {
  id: string;
  name: string;
  provider: string;
  status: string;
};

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  calendarId: string | null;
};

type Staff = {
  id: string;
  name: string;
  email: string | null;
  timezone: string | null;
  calendarId: string | null;
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const urlNotice = useMemo(() => {
    const oauth = searchParams.get("oauth");
    const err = searchParams.get("oauth_error");
    if (oauth) return `Calendar connected (${oauth})`;
    if (err) return `OAuth error: ${err}`;
    return null;
  }, [searchParams]);
  const notice = actionNotice ?? urlNotice;
  const setNotice = setActionNotice;

  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [svcForm, setSvcForm] = useState({ name: "", durationMinutes: 30, bufferMinutes: 0, calendarId: "" });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", timezone: "", calendarId: "" });

  function load() {
    fetch("/api/voice/calendars").then((r) => r.json()).then((j) => setConnections(j.data || []));
    fetch("/api/voice/services").then((r) => r.json()).then((j) => setServices(j.data || [])).catch(() => undefined);
    fetch("/api/voice/staff").then((r) => r.json()).then((j) => setStaff(j.data || [])).catch(() => undefined);
  }

  useEffect(() => {
    load();
  }, []);

  async function createService() {
    if (!svcForm.name.trim()) return;
    await fetch("/api/voice/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...svcForm, calendarId: svcForm.calendarId || null }),
    });
    setSvcForm({ name: "", durationMinutes: 30, bufferMinutes: 0, calendarId: "" });
    load();
  }

  async function deleteService(id: string) {
    await fetch(`/api/voice/services/${id}`, { method: "DELETE" });
    load();
  }

  async function createStaff() {
    if (!staffForm.name.trim()) return;
    await fetch("/api/voice/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...staffForm, calendarId: staffForm.calendarId || null }),
    });
    setStaffForm({ name: "", email: "", timezone: "", calendarId: "" });
    load();
  }

  async function deleteStaff(id: string) {
    await fetch(`/api/voice/staff/${id}`, { method: "DELETE" });
    load();
  }

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
      window.location.assign(`/api/voice/calendars/oauth/google?connectionId=${conn.id}`);
    } else if (conn?.provider === "microsoft") {
      window.location.assign(`/api/voice/calendars/oauth/microsoft?connectionId=${conn.id}`);
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

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Services</CardTitle>
          <p className="text-xs text-muted-foreground">
            Bookable services with a duration and buffer used to compute availability.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} placeholder="Consultation" />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" value={svcForm.durationMinutes} onChange={(e) => setSvcForm({ ...svcForm, durationMinutes: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Buffer (min)</Label>
              <Input type="number" value={svcForm.bufferMinutes} onChange={(e) => setSvcForm({ ...svcForm, bufferMinutes: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <Label>Calendar</Label>
              <Select value={svcForm.calendarId} onChange={(e) => setSvcForm({ ...svcForm, calendarId: e.target.value })}>
                <option value="">— none —</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={createService} disabled={!svcForm.name.trim()} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add service
          </Button>
          <div className="space-y-1">
            {services.length === 0 ? (
              <p className="text-xs text-muted-foreground">No services yet.</p>
            ) : (
              services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{s.name} · {s.durationMinutes}m{s.bufferMinutes ? ` (+${s.bufferMinutes}m buffer)` : ""}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteService(s.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Staff</CardTitle>
          <p className="text-xs text-muted-foreground">
            Staff members whose calendars can be used for booking appointments.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} placeholder="jane@co.com" />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={staffForm.timezone} onChange={(e) => setStaffForm({ ...staffForm, timezone: e.target.value })} placeholder="America/New_York" />
            </div>
            <div className="col-span-2">
              <Label>Calendar</Label>
              <Select value={staffForm.calendarId} onChange={(e) => setStaffForm({ ...staffForm, calendarId: e.target.value })}>
                <option value="">— none —</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={createStaff} disabled={!staffForm.name.trim()} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add staff
          </Button>
          <div className="space-y-1">
            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground">No staff yet.</p>
            ) : (
              staff.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{s.name}{s.email ? ` · ${s.email}` : ""}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteStaff(s.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

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
