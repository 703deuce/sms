"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { RoutingForm, RoutingFormRule } from "@/lib/appointments/scheduling-capabilities";
import { presetCompanySizeOptions, presetIndustryOptions } from "@/lib/appointments/routing-forms-presets";
import { Plus, Trash2, ExternalLink } from "lucide-react";

function emptyForm(): RoutingForm {
  return {
    id: `rf_${Date.now()}`,
    name: "New routing form",
    slug: "new-form",
    active: true,
    headline: "How can we help you?",
    fields: [
      { id: "industry", label: "Industry", type: "select", required: true, options: presetIndustryOptions() },
      { id: "company_size", label: "Company size", type: "select", required: true, options: presetCompanySizeOptions() },
    ],
    rules: [
      {
        id: "rule_industry",
        priority: 1,
        logic: "and",
        conditions: [{ fieldId: "industry", operator: "equals", value: "Healthcare" }],
        destination: { appointmentTypeId: "" },
      },
    ],
    fallbackDestination: { externalUrl: "" },
  };
}

export function RoutingFormsClient({ workspaceSlug }: { workspaceSlug: string }) {
  const [forms, setForms] = useState<RoutingForm[]>([]);
  const [selected, setSelected] = useState<RoutingForm | null>(null);
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  const [analytics, setAnalytics] = useState<Record<string, { views: number; routes: Record<string, number> }>>({});

  const load = useCallback(async () => {
    const [formsRes, typesRes, settingsRes] = await Promise.all([
      fetch("/api/appointments/routing-forms"),
      fetch("/api/appointments/types"),
      fetch("/api/appointments/settings"),
    ]);
    if (formsRes.ok) {
      const json = await formsRes.json();
      const list = (json.data || []) as RoutingForm[];
      setForms(list);
      if (!selected && list[0]) setSelected(list[0]);
    }
    if (typesRes.ok) {
      const json = await typesRes.json();
      setTypes((json.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    }
    if (settingsRes.ok) {
      const json = await settingsRes.json();
      const s = (json.data?.staff || []) as Array<{ id: string; name: string }>;
      setStaff(s.map((m) => ({ id: m.id, name: m.name })));
      setAnalytics((json.data?.routingAnalytics || {}) as Record<string, { views: number; routes: Record<string, number> }>);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(form: RoutingForm) {
    setSaving(true);
    await fetch("/api/appointments/routing-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    await load();
  }

  const publicUrl = selected
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/routing/${workspaceSlug}/${selected.slug}`
    : "";

  return (
    <div className="px-6 py-6 lg:px-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Routing forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calendly-style intake forms that route leads by answers.
          </p>
        </div>
        <Button
          onClick={() => {
            const f = emptyForm();
            setForms((prev) => [...prev, f]);
            setSelected(f);
          }}
        >
          <Plus className="h-4 w-4" /> New form
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-3">
          {forms.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`w-full text-left rounded-lg px-3 py-2 text-[13px] mb-1 ${
                selected?.id === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              }`}
              onClick={() => setSelected(f)}
            >
              {f.name}
            </button>
          ))}
        </Card>

        {selected ? (
          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Form name</Label>
                <Input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                />
              </div>
              <div>
                <Label>URL slug</Label>
                <Input
                  value={selected.slug}
                  onChange={(e) => setSelected({ ...selected, slug: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Headline</Label>
              <Input
                value={selected.headline || ""}
                onChange={(e) => setSelected({ ...selected, headline: e.target.value })}
              />
            </div>

            <div>
              <CardTitle className="text-sm mb-2">Routing rules</CardTitle>
              {selected.rules.map((rule, ri) => (
                <div key={rule.id} className="rounded-lg border p-3 mb-2 space-y-2">
                  <select
                    className="input w-full"
                    value={rule.destination.appointmentTypeId || rule.destination.staffId || rule.destination.externalUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = [...selected.rules];
                      let dest: RoutingFormRule["destination"] = {};
                      if (val.startsWith("staff:")) dest = { staffId: val.replace("staff:", "") };
                      else if (val.startsWith("http")) dest = { externalUrl: val };
                      else dest = { appointmentTypeId: val };
                      next[ri] = { ...rule, destination: dest };
                      setSelected({ ...selected, rules: next });
                    }}
                  >
                    <option value="">Route to…</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    {staff.map((s) => (
                      <option key={s.id} value={`staff:${s.id}`}>Staff: {s.name}</option>
                    ))}
                  </select>
                  {rule.conditions[0] ? (
                    <p className="text-[12px] text-muted-foreground">
                      When {rule.conditions[0].fieldId} {rule.conditions[0].operator} {rule.conditions[0].value}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {selected && analytics[selected.id] ? (
              <Card className="p-4 bg-muted/30">
                <p className="text-sm font-semibold">Routing analytics</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {analytics[selected.id].views} views ·{" "}
                  {Object.keys(analytics[selected.id].routes).length} destinations used
                </p>
                <ul className="mt-2 text-[12px] space-y-1">
                  {Object.entries(analytics[selected.id].routes).map(([dest, count]) => (
                    <li key={dest} className="flex justify-between">
                      <span className="truncate">{dest}</span>
                      <span className="font-medium">{count}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div className="flex items-center gap-3">
              <Button onClick={() => save(selected)} disabled={saving}>
                {saving ? "Saving…" : "Save form"}
              </Button>
              {publicUrl ? (
                <Button variant="outline" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Preview
                  </a>
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
