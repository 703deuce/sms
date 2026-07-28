import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";

const customFields = [
  {
    name: "First name",
    key: "first_name",
    type: "Text",
    required: true,
    usedIn: "Merge tags, personalization",
    system: true,
  },
  {
    name: "Last name",
    key: "last_name",
    type: "Text",
    required: false,
    usedIn: "Merge tags, personalization",
    system: true,
  },
  {
    name: "Company",
    key: "company",
    type: "Text",
    required: false,
    usedIn: "Segments, merge tags",
    system: false,
  },
  {
    name: "Birthday",
    key: "birthday",
    type: "Date",
    required: false,
    usedIn: "Birthday automation trigger",
    system: false,
  },
  {
    name: "Appointment date",
    key: "appointment_date",
    type: "Date",
    required: false,
    usedIn: "Reminder campaigns",
    system: false,
  },
  {
    name: "Customer type",
    key: "customer_type",
    type: "Dropdown",
    required: false,
    usedIn: "Segments, reporting",
    system: false,
  },
  {
    name: "Location",
    key: "location",
    type: "Text",
    required: false,
    usedIn: "Geo-targeted campaigns",
    system: false,
  },
  {
    name: "Last purchase",
    key: "last_purchase",
    type: "Date",
    required: false,
    usedIn: "Re-engagement segments",
    system: false,
  },
];

export default function ContactFieldsPage() {
  const customCount = customFields.filter((f) => !f.system).length;

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Custom fields"
        description="Extend contact profiles with business-specific data for merge tags and segmentation."
        actions={
          <Button className="rounded-[10px]">
            <Plus className="h-4 w-4" />
            Add field
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total fields"
          value={customFields.length}
          icon={SlidersHorizontal}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Custom fields"
          value={customCount}
          icon={Plus}
          tone="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Used in automations"
          value={2}
          hint="Birthday, appointment date"
          icon={SlidersHorizontal}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Field definitions</h2>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Field name</TH>
              <TH>Key</TH>
              <TH>Type</TH>
              <TH>Required</TH>
              <TH>Used in</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {customFields.map((field) => (
              <TR key={field.key}>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    {field.system ? <StatusChip status="Active" className="text-[10px]" /> : null}
                  </div>
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{`{{${field.key}}}`}</TD>
                <TD>{field.type}</TD>
                <TD>{field.required ? "Yes" : "No"}</TD>
                <TD className="text-muted-foreground">{field.usedIn}</TD>
                <TD>
                  {field.system ? (
                    <span className="text-xs text-muted-foreground">System field</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" className="font-medium text-primary hover:underline">
                        Edit
                      </button>
                      <button type="button" className="font-medium text-rose-600 hover:underline">
                        Delete
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                        aria-label="More"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <PaginationBar
          rangeLabel={`Showing ${customFields.length} of ${customFields.length} fields`}
        />
      </Card>
    </div>
  );
}
