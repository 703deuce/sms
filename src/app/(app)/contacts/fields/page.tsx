import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Plus } from "lucide-react";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

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
    <div>
      <PageHeader
        title="Custom fields"
        description="Extend contact profiles with business-specific data for merge tags and segmentation."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Add field
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total fields</p>
          <p className="mt-2 font-display text-2xl font-semibold">{customFields.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom fields</p>
          <p className="mt-2 font-display text-2xl font-semibold">{customCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Used in automations</p>
          <p className="mt-2 font-display text-2xl font-semibold">2</p>
          <p className="mt-1 text-xs text-muted-foreground">Birthday, appointment date</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Field definitions</CardTitle>
        <Table className="mt-4">
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
                    {field.system ? (
                      <StatusChip status="Active" className="text-[10px]" />
                    ) : null}
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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm">
                        Delete
                      </Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
