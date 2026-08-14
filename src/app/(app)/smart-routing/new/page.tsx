"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Template = {
  type: string;
  title: string;
  subtitle: string;
  bestFor: string[];
};

export default function SmartRoutingNewPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/smart-routing/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.data ?? []));
  }, []);

  async function pickTemplate(type: string, title: string) {
    setCreating(type);
    const res = await fetch("/api/smart-routing/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name: title }),
    });
    const json = await res.json();
    if (json.data?.id) router.push(`/smart-routing/${json.data.id}`);
    setCreating(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Create Call Flow"
        description="Choose a template to get started quickly, or build a custom flow."
      />
      <SmartRoutingSubNav active="flows" />
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.type} className="p-5">
            <h3 className="font-semibold text-slate-900">{t.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
            <p className="mt-3 text-xs text-slate-500">
              Best for: {t.bestFor.join(", ")}
            </p>
            <Button
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
              disabled={creating === t.type}
              onClick={() => pickTemplate(t.type, t.title)}
            >
              {creating === t.type ? "Creating…" : "Use template"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
