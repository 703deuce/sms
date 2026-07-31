"use client";

import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const surveyTabs = [
  { label: "All", href: "/surveys" },
  { label: "Polls", href: "/surveys?type=poll" },
  { label: "Surveys", href: "/surveys?type=survey" },
  { label: "NPS", href: "/surveys?type=nps" },
];

type SurveyRow = {
  id: string;
  name: string;
  surveyType: string;
  status: string;
  updatedAt: string;
};

export default function SurveysPage() {
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [name, setName] = useState("Customer feedback");
  const [surveyType, setSurveyType] = useState("poll");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTypeFilter(params.get("type"));
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => r.surveyType === typeFilter);
  }, [rows, typeFilter]);

  async function create() {
    setSaving(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, surveyType }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) window.location.href = `/surveys/${json.data.id}`;
  }

  const active = filtered.filter((r) => r.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Surveys"
        description="Polls, multi-question surveys, and NPS with response dashboards and CSV export."
      />
      <Tabs items={surveyTabs} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={String(filtered.length)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard label="Types" value="Poll · Survey · NPS" />
      </div>
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value)}
          >
            <option value="poll">Poll</option>
            <option value="survey">Survey</option>
            <option value="nps">NPS</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button onClick={create} disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? "Creating…" : "New survey"}
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link href={`/surveys/${r.id}`} className="font-medium hover:text-primary">
                    {r.name}
                  </Link>
                </TD>
                <TD className="capitalize">{r.surveyType}</TD>
                <TD><StatusChip status={r.status} /></TD>
                <TD>{new Date(r.updatedAt).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
