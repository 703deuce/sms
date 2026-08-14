"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Flow = {
  id: string;
  name: string;
  status: string;
  type: string;
  draftConfigJson: DraftConfig;
  triggerMode: string;
  timezone: string;
  businessNumberE164?: string | null;
  routingNumberE164?: string | null;
  numberMode: string;
  assignedPhoneNumberId?: string | null;
};

type PhoneNumber = { id: string; e164: string; label?: string };

export default function SmartRoutingBuilderPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [saving, setSaving] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [menuOptions, setMenuOptions] = useState<
    Array<{ digit: string; label: string; phoneNumber: string }>
  >([]);

  function load() {
    fetch(`/api/smart-routing/flows/${flowId}`)
      .then((r) => r.json())
      .then((j) => {
        const f = j.data as Flow;
        setFlow(f);
        const draft = f.draftConfigJson ?? { nodes: [], edges: [] };
        setGreetingText(draft.greeting?.text ?? "");
        setMenuOptions(
          (draft.menuOptions ?? []).map((o) => ({
            digit: o.digit,
            label: o.label,
            phoneNumber: o.phoneNumber ?? "",
          })),
        );
      });
    fetch("/api/numbers")
      .then((r) => r.json())
      .then((j) => setNumbers(j.data ?? j.numbers ?? []));
  }

  useEffect(() => {
    load();
  }, [flowId]);

  async function saveDraft() {
    if (!flow) return;
    setSaving(true);
    const draftConfig: DraftConfig = {
      ...flow.draftConfigJson,
      greeting: {
        source: "elevenlabs",
        text: greetingText,
        audioAssetId: flow.draftConfigJson?.greeting?.audioAssetId,
      },
      menuOptions: menuOptions.map((o) => ({
        digit: o.digit,
        label: o.label,
        action: "transfer",
        phoneNumber: o.phoneNumber,
      })),
    };
    await fetch(`/api/smart-routing/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: flow.name,
        draftConfig,
        triggerMode: flow.triggerMode,
        timezone: flow.timezone,
        businessNumberE164: flow.businessNumberE164,
        routingNumberE164: flow.routingNumberE164,
        numberMode: flow.numberMode,
        assignedPhoneNumberId: flow.assignedPhoneNumberId,
      }),
    });
    setSaving(false);
    load();
  }

  async function generateAudio() {
    if (!greetingText.trim()) return;
    await fetch("/api/smart-routing/audio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Main greeting",
        text: greetingText,
        voiceId: "EXAVITQu4vr4xnSDxMaL",
      }),
    });
    alert("Greeting audio generated. Save and publish to use on calls.");
  }

  if (!flow) {
    return <div className="p-6 text-sm text-slate-500">Loading flow…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title={flow.name} description="Configure greeting, menu, destinations, and schedule." />
      <SmartRoutingSubNav flowId={flowId} active="builder" />

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Flow information</h2>
        <div>
          <Label>Flow name</Label>
          <Input
            value={flow.name}
            onChange={(e) => setFlow({ ...flow, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Assigned number</Label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={flow.assignedPhoneNumberId ?? ""}
            onChange={(e) =>
              setFlow({ ...flow, assignedPhoneNumberId: e.target.value || null })
            }
          >
            <option value="">Select a number</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>{n.e164}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Your main number (customers call)</Label>
            <Input
              placeholder="(571) 555-0188"
              value={flow.businessNumberE164 ?? ""}
              onChange={(e) => setFlow({ ...flow, businessNumberE164: e.target.value })}
            />
          </div>
          <div>
            <Label>Transovo routing number (forwarding target)</Label>
            <Input
              placeholder="(540) XXX-XXXX"
              value={flow.routingNumberE164 ?? ""}
              onChange={(e) => setFlow({ ...flow, routingNumberE164: e.target.value })}
            />
          </div>
        </div>
        <Link href="/numbers" className="text-sm text-indigo-600 hover:underline">
          View call forwarding instructions
        </Link>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">When this flow runs</h2>
        <select
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={flow.triggerMode}
          onChange={(e) => setFlow({ ...flow, triggerMode: e.target.value })}
        >
          <option value="every_call">Every call</option>
          <option value="no_answer">No answer</option>
          <option value="busy">Busy</option>
          <option value="after_hours">After hours</option>
          <option value="custom_schedule">Custom schedule</option>
        </select>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Greeting</h2>
        <Label>Professional AI voice (recommended)</Label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={3}
          value={greetingText}
          onChange={(e) => setGreetingText(e.target.value)}
          placeholder="Thanks for calling John's Plumbing."
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateAudio}>Generate audio</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Menu options</h2>
        <p className="text-sm text-slate-600">What should callers be able to choose?</p>
        {menuOptions.map((opt, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3">
            <Input
              placeholder="Digit"
              value={opt.digit}
              onChange={(e) => {
                const next = [...menuOptions];
                next[idx] = { ...opt, digit: e.target.value };
                setMenuOptions(next);
              }}
            />
            <Input
              placeholder="Label"
              value={opt.label}
              onChange={(e) => {
                const next = [...menuOptions];
                next[idx] = { ...opt, label: e.target.value };
                setMenuOptions(next);
              }}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Phone destination"
                value={opt.phoneNumber}
                onChange={(e) => {
                  const next = [...menuOptions];
                  next[idx] = { ...opt, phoneNumber: e.target.value };
                  setMenuOptions(next);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOptions(menuOptions.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMenuOptions([...menuOptions, { digit: "", label: "", phoneNumber: "" }])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add option
        </Button>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={saveDraft} disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Link href={`/smart-routing/${flowId}/test`}>
          <Button variant="outline">Test & activate</Button>
        </Link>
      </div>
    </div>
  );
}
