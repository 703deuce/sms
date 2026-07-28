"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { templates } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const templateTabs = [
  { label: "All templates", href: "/templates" },
  { label: "Create new", href: "/templates/new" },
  { label: "AI generator", href: "/templates/ai" },
];

const categories = [
  "All",
  "Greetings",
  "Appointment reminders",
  "Sales",
  "Customer service",
  "Promotions",
  "Compliance",
] as const;

const typeFilters = [
  "All types",
  "Campaign",
  "Inbox reply",
  "Automation message",
  "Compliance message",
] as const;

export default function TemplatesPage() {
  const [category, setCategory] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All types");

  const filtered = templates.filter((t) => {
    const matchCategory = category === "All" || t.category === category;
    const matchType = typeFilter === "All types" || t.type === typeFilter;
    return matchCategory && matchType;
  });

  const smsCount = templates.filter((t) => t.channel === "SMS").length;
  const sharedCount = templates.filter((t) => t.shared).length;

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable SMS and MMS message templates for campaigns, inbox replies, and automations."
        actions={
          <>
            <Link href="/templates/ai">
              <Button variant="outline">
                <Sparkles className="h-4 w-4" />
                AI generator
              </Button>
            </Link>
            <Link href="/templates/new">
              <Button>Create template</Button>
            </Link>
          </>
        }
      />

      <Tabs items={templateTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Templates" value={formatNumber(templates.length)} />
        <StatCard label="SMS templates" value={formatNumber(smsCount)} />
        <StatCard label="Shared with team" value={formatNumber(sharedCount)} />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                category === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition",
                typeFilter === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No templates match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different category or create a new template.
          </p>
          <Link href="/templates/new" className="mt-4 inline-block">
            <Button size="sm">Create template</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <CardTitle>
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          <div className="mt-4">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH>Type</TH>
                  <TH>Channel</TH>
                  <TH>Shared</TH>
                  <TH>Preview</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD className="text-muted-foreground">{t.category}</TD>
                    <TD>
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {t.type}
                      </span>
                    </TD>
                    <TD>{t.channel}</TD>
                    <TD>{t.shared ? "Yes" : "No"}</TD>
                    <TD className="max-w-xs truncate text-muted-foreground">{t.body}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
