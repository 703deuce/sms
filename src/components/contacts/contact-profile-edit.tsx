"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

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
    await fetch("/api/contacts/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, timezone: tz, linkedin: li }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="p-4">
      <CardTitle className="text-sm mb-3">Scheduling profile</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Timezone</Label>
          <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/New_York" />
        </div>
        <div>
          <Label>LinkedIn</Label>
          <Input value={li} onChange={(e) => setLi(e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
      </div>
      <Button size="sm" className="mt-3" onClick={save} disabled={saving}>
        {saved ? "Saved" : saving ? "Saving…" : "Save profile"}
      </Button>
    </Card>
  );
}
