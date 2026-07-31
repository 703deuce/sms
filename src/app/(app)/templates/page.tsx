"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
  TableToolbar,
} from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { Template, User } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import {
  Eye,
  FileText,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const templateIconTones = [
  "bg-emerald-50 text-emerald-600",
  "bg-sky-50 text-sky-600",
  "bg-violet-50 text-violet-600",
  "bg-orange-50 text-orange-600",
];

const categoryTones: Record<string, string> = {
  Greetings: "bg-emerald-50 text-emerald-700",
  "Appointment reminders": "bg-orange-50 text-orange-700",
  Sales: "bg-violet-50 text-violet-700",
  "Customer service": "bg-sky-50 text-sky-700",
  Promotions: "bg-pink-50 text-pink-700",
  Compliance: "bg-rose-50 text-rose-700",
};

const typeTones: Record<string, string> = {
  Campaign: "bg-blue-50 text-blue-700",
  "Inbox reply": "bg-teal-50 text-teal-700",
  "Automation message": "bg-emerald-50 text-emerald-700",
  "Compliance message": "bg-rose-50 text-rose-700",
};

export default function TemplatesPage() {
  const [category, setCategory] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All types");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setTemplates(json.data);
      })
      .catch(() => undefined);
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setTeamMembers(json.data);
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        const matchCategory = category === "All" || t.category === category;
        const matchType = typeFilter === "All types" || t.type === typeFilter;
        return matchCategory && matchType;
      }),
    [category, typeFilter, templates],
  );

  const smsCount = templates.filter((t) => t.channel === "SMS").length;
  const sharedCount = templates.filter((t) => t.shared).length;

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={LayoutGrid}
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
              <Button>
                <Plus className="h-4 w-4" />
                Create template
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={templateTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Templates"
          value={formatNumber(templates.length)}
          icon={LayoutGrid}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[2, 3, 3, 4, 4, 4, 4, templates.length]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="SMS templates"
          value={formatNumber(smsCount)}
          icon={MessageSquare}
          tone="bg-sky-50 text-sky-600"
          sparkline={[2, 3, 3, 4, 4, 4, 4, smsCount]}
          sparkColor="#0ea5e9"
        />
        <MetricCard
          label="Shared with team"
          value={formatNumber(sharedCount)}
          icon={Users}
          tone="bg-violet-50 text-violet-600"
          sparkline={[1, 2, 3, 3, 4, 4, 4, sharedCount]}
          sparkColor="#8b5cf6"
        />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
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

      <div className="mb-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-[10px] border px-3 py-1.5 text-[13px] transition",
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
        <Card className="rounded-[12px] py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No templates match your filters</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try a different category or create a new template.
          </p>
          <Link href="/templates/new" className="mt-4 inline-block">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Create template
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="rounded-[12px] p-4">
          <TableToolbar
            title={`${filtered.length} template${filtered.length !== 1 ? "s" : ""}`}
            searchPlaceholder="Search templates..."
          >
            <Button variant="outline" size="sm" className="text-[13px]">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            <div className="flex items-center rounded-[10px] border border-border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </TableToolbar>

          {viewMode === "list" ? (
            <Table className="text-[13px]">
              <THead>
                <TR>
                  <TH className="w-12" />
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH>Type</TH>
                  <TH>Channel</TH>
                  <TH>Shared</TH>
                  <TH>Preview</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((template, index) => (
                  <TR key={template.id}>
                    <TD>
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-[10px]",
                          templateIconTones[index % templateIconTones.length],
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </span>
                    </TD>
                    <TD>
                      <div>
                        <p className="font-semibold text-foreground">{template.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          ID: tpl_{String(template.id.replace("tpl_", "")).padStart(3, "0")}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          categoryTones[template.category] ?? "bg-muted text-foreground",
                        )}
                      >
                        {template.category}
                      </span>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          typeTones[template.type] ?? "border border-border bg-card text-muted-foreground",
                        )}
                      >
                        {template.type}
                      </span>
                    </TD>
                    <TD>{template.channel}</TD>
                    <TD className="text-muted-foreground">
                      {template.shared ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Yes · 3 members
                        </span>
                      ) : (
                        "No"
                      )}
                    </TD>
                    <TD className="max-w-[220px] truncate text-muted-foreground">
                      {template.body}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="text-[12px]">
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">More actions</span>
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((template, index) => (
                <div
                  key={template.id}
                  className="rounded-[12px] border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                        templateIconTones[index % templateIconTones.length],
                      )}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{template.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                          {template.category}
                        </span>
                        <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {template.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-[12px] text-muted-foreground">
                    {template.body}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[12px] text-muted-foreground">
                      {template.shared
                        ? `Shared · ${teamMembers.length} members`
                        : "Private"}
                    </span>
                    <Button variant="outline" size="sm" className="text-[12px]">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <PaginationBar
            rangeLabel={`1–${filtered.length} of ${filtered.length}`}
          />
        </Card>
      )}
    </div>
  );
}
