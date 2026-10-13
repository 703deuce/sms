"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Search, Sparkles, Wrench } from "lucide-react";
import type { OfferingOption } from "@/features/appointments/kimi/packages/use-package-editor";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/newui-transplant/components/ui/sheet";
import { OpusSearchField } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { OpusIconBadge } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/newui-transplant/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabId = "services" | "classes" | "courses";

function kindIcon(kind: OfferingOption["kind"]) {
  if (kind === "class" || kind === "workshop") return GraduationCap;
  return Wrench;
}

function kindLabel(kind: OfferingOption["kind"]) {
  switch (kind) {
    case "service":
      return "Service";
    case "meeting":
      return "Meeting";
    case "class":
      return "Class";
    case "workshop":
      return "Workshop";
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerings: OfferingOption[];
  selectedIds: Set<string>;
  onAdd: (offering: OfferingOption) => void;
  returnDraftKey?: string;
};

export function OfferingPickerSheet({
  open,
  onOpenChange,
  offerings,
  selectedIds,
  onAdd,
  returnDraftKey = "transovo-package-wizard-draft",
}: Props) {
  const [tab, setTab] = useState<TabId>("services");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offerings.filter((o) => {
      if (tab === "services") {
        if (o.kind !== "service" && o.kind !== "meeting") return false;
      } else if (tab === "classes") {
        if (o.kind !== "class" && o.kind !== "workshop") return false;
        if (o.meta.toLowerCase().includes("full series") || o.meta.toLowerCase().includes("course")) {
          return false;
        }
      } else {
        if (o.kind !== "class" && o.kind !== "workshop") return false;
        if (!o.meta.toLowerCase().includes("full series") && !o.meta.toLowerCase().includes("course")) {
          return false;
        }
      }
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || o.meta.toLowerCase().includes(q);
    });
  }, [offerings, search, tab]);

  const createHref =
    tab === "services"
      ? `/appointments/services/new?returnTo=/appointments/packages/new&draftKey=${encodeURIComponent(returnDraftKey)}`
      : tab === "courses"
        ? `/appointments/classes/new?course=1&returnTo=/appointments/packages/new&draftKey=${encodeURIComponent(returnDraftKey)}`
        : `/appointments/classes/new?returnTo=/appointments/packages/new&draftKey=${encodeURIComponent(returnDraftKey)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Add service or class</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList className="h-9 w-full">
              <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
              <TabsTrigger value="classes" className="flex-1">Classes</TabsTrigger>
              <TabsTrigger value="courses" className="flex-1">Courses</TabsTrigger>
            </TabsList>
          </Tabs>
          <OpusSearchField
            id="offering-picker-search"
            label="Search offerings"
            placeholder="Search by name"
            value={search}
            onChange={setSearch}
          />
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No matches. Create a new offering below.
              </li>
            ) : (
              filtered.map((o) => {
                const Icon = kindIcon(o.kind);
                const added = selectedIds.has(o.id);
                return (
                  <li
                    key={`${o.kind}-${o.id}`}
                    className="flex min-h-[72px] items-center gap-3 rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgba(16,18,40,0.04)]"
                  >
                    <OpusIconBadge icon={Icon} className="size-9 shrink-0 rounded-lg bg-primary/10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {kindLabel(o.kind)} · {o.meta}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={added ? "secondary" : "default"}
                      disabled={added}
                      onClick={() => onAdd(o)}
                    >
                      {added ? "Added" : "Add"}
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t pt-4">
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link href={createHref} onClick={() => onOpenChange(false)}>
                <Plus className="mr-2 size-4" aria-hidden />
                Create new {tab === "services" ? "service" : tab === "courses" ? "course" : "class"}
              </Link>
            </Button>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              Your package draft is saved while you create offerings.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
