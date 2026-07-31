"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { estimateSmsSegments } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const mergeFields = [
  "{{first_name}}",
  "{{last_name}}",
  "{{business_name}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{phone}}",
];

export function NewTemplateForm({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [type, setType] = useState("Campaign");
  const [channel, setChannel] = useState("SMS");
  const [body, setBody] = useState(
    "Hi {{first_name}}, thanks for connecting with {{business_name}}! Reply HELP for help, STOP to opt out.",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segments = useMemo(() => estimateSmsSegments(body), [body]);
  const preview = body
    .replace(/\{\{first_name\}\}/gi, "Alex")
    .replace(/\{\{business_name\}\}/gi, businessName || "Your Business");

  function insertField(field: string) {
    setBody((prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${field}`);
  }

  async function save(createAnother: boolean) {
    if (!name.trim() || !body.trim()) {
      setError("Name and body are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, type, channel, body }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save");
      if (createAnother) {
        setName("");
        router.refresh();
      } else {
        router.push("/templates");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardTitle>Template details</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="name">Template name</Label>
              <Input
                id="name"
                placeholder="e.g. Welcome SMS"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>General</option>
                  <option>Welcome</option>
                  <option>Reminder</option>
                  <option>Promotion</option>
                  <option>Support</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                  <option>Campaign</option>
                  <option>Inbox reply</option>
                  <option>Automation message</option>
                  <option>Compliance message</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="channel">Channel</Label>
              <Select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option>SMS</option>
                <option>MMS</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="body">Message body</Label>
              <Textarea
                id="body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {segments.characters} characters · {segments.segments} segment
                {segments.segments !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Merge fields</CardTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            {mergeFields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => insertField(field)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                {field}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Preview</CardTitle>
        <div className="mt-4">
          <div className="rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-3 text-sm leading-relaxed">
            {preview}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Preview uses sample data from your workspace.
          </p>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-2">
          <Button disabled={saving} onClick={() => save(false)}>
            {saving ? "Saving…" : "Save template"}
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => save(true)}>
            Save and create another
          </Button>
        </div>
      </Card>
    </div>
  );
}
