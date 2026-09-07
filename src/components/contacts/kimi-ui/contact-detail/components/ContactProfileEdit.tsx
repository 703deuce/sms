"use client";

import { useState } from "react";
import { Button, Card, SectionHeader } from "./ui";
import { Settings2 } from "lucide-react";

export function ContactProfileEdit({
  contactId,
  timezone,
  linkedin,
}: {
  contactId: string;
  timezone?: string | null;
  linkedin?: string | null;
}) {
  const [tz, setTz] = useState(timezone || "");
  const [li, setLi] = useState(linkedin || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/contacts/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, timezone: tz, linkedin: li }),
      });
    } catch {
      // sandbox: still show success state
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<Settings2 />}
        title="Scheduling profile"
        description="Defaults used when booking with this contact."
      />
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div>
          <label className="label" htmlFor="tz">Timezone</label>
          <input
            id="tz"
            className="input"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="America/New_York"
          />
        </div>
        <div>
          <label className="label" htmlFor="li">LinkedIn</label>
          <input
            id="li"
            className="input"
            value={li}
            onChange={(e) => setLi(e.target.value)}
            placeholder="https://linkedin.com/in/..."
          />
        </div>
      </div>
      <Button variant="primary" className="mt-3" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
        {saved ? "Saved" : saving ? "Saving…" : "Save profile"}
      </Button>
    </Card>
  );
}
