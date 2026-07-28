import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  SectionHeader,
} from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { segments } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import {
  ChevronRight,
  Filter,
  Flame,
  Info,
  LineChart,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function ContactSegmentsPage() {
  const totalReach = segments.reduce((sum, seg) => sum + seg.count, 0);
  const top = [...segments].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Segments"
        description="Dynamic audiences based on behavior, engagement, and contact properties."
        actions={
          <Button className="rounded-[10px]">
            <Plus className="h-4 w-4" />
            Create segment
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Active Segments"
          value={formatNumber(segments.length)}
          hint="Live segment definitions"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
        />
        <div className="surface rounded-[12px] bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Combined Reach
              </p>
              <p className="mt-2 text-[22px] font-bold tracking-tight text-foreground">
                {formatNumber(totalReach)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                Unique contacts may overlap
                <Info className="h-3.5 w-3.5" aria-hidden />
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600">
              <LineChart className="h-5 w-5" />
            </span>
          </div>
        </div>
        <a
          href="#segment-cards"
          className="block transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="surface rounded-[12px] bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Most Engaged
                </p>
                <p className="mt-2 text-[18px] font-bold tracking-tight text-foreground">
                  {top?.name ?? "—"}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {formatNumber(top?.count ?? 0)} contacts
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
                  <Flame className="h-5 w-5" />
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </a>
      </div>

      <div id="segment-cards" className="mb-5 grid gap-4 lg:grid-cols-2">
        {segments.map((segment) => (
          <Card key={segment.id} className="rounded-[12px] p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Filter className="h-5 w-5" />
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit rules
              </button>
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-foreground">{segment.name}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {formatNumber(segment.count)}
              </span>{" "}
              matching contacts
            </p>
            <div className="mt-4 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Conditions
              </p>
              <p className="mt-1 text-[13px] text-foreground">{segment.conditions}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="rounded-[10px]">
                Preview contacts
              </Button>
              <Link href="/send">
                <Button size="sm" className="rounded-[10px]">
                  <Send className="h-3.5 w-3.5" />
                  Use in campaign
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-[12px] p-4">
        <h2 className="mb-4 text-[14px] font-bold text-foreground">Segment rules</h2>
        <Table className="text-[13px]">
          <THead>
            <TR>
              <TH>Segment</TH>
              <TH>Count</TH>
              <TH>Conditions</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {segments.map((segment) => (
              <TR key={segment.id}>
                <TD className="font-semibold">{segment.name}</TD>
                <TD className="tabular-nums">{formatNumber(segment.count)}</TD>
                <TD className="max-w-md text-muted-foreground">{segment.conditions}</TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-[12px]">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Link href="/send">
                      <Button variant="ghost" size="sm" className="text-[12px]">
                        <Send className="h-3.5 w-3.5" />
                        Use in campaign
                      </Button>
                    </Link>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label={`More actions for ${segment.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          {segments.length} segments
        </p>
      </Card>
    </div>
  );
}
