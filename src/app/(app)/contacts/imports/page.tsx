import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { Label, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { auditLogs } from "@/lib/mock/data";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import Link from "next/link";

const fieldMappings = [
  { csvColumn: "first_name", transovoField: "First name", sample: "Maya" },
  { csvColumn: "last_name", transovoField: "Last name", sample: "Chen" },
  { csvColumn: "mobile", transovoField: "Phone", sample: "+14155550101" },
  { csvColumn: "email_address", transovoField: "Email", sample: "maya.chen@email.com" },
  { csvColumn: "opt_in_date", transovoField: "Consent date", sample: "2026-03-12" },
  { csvColumn: "source", transovoField: "Consent source", sample: "Web form" },
];

const importTags = ["sms-opt-in", "import-july"];

const importHistory = [
  {
    id: "imp_1",
    at: "2026-07-18T14:22:00Z",
    file: "leads-june.csv",
    actor: "Alex Rivera",
    status: "Completed",
  },
  ...auditLogs
    .filter((log) => log.event === "Contact import")
    .map((log) => ({
      id: log.id,
      at: log.at,
      file: log.detail,
      actor: log.actor,
      status: "Completed",
    })),
];

export default function ContactImportsPage() {
  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Imports"
        description="Upload opted-in contacts with field mapping and consent confirmation."
        actions={
          <Link href="/contacts">
            <Button variant="outline" className="rounded-[10px]">
              View all contacts
            </Button>
          </Link>
        }
      />

      <Tabs items={contactTabs} />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="rounded-[12px] p-5">
            <CardTitle>Step 1 — Upload file</CardTitle>
            <p className="mt-1 text-[12px] text-muted-foreground">
              CSV or XLSX with phone numbers and documented consent for each contact.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Upload className="h-6 w-6" />
              </span>
              <p className="mt-3 font-semibold text-foreground">
                Drag and drop your file here or click to browse
              </p>
              <Button variant="outline" className="mt-4 rounded-[10px] border-primary text-primary">
                Choose file
              </Button>
              <p className="mt-3 text-[12px] text-muted-foreground">
                Sample file: leads-june.csv · 214 rows · 6 columns
              </p>
            </div>
          </Card>

          <Card className="rounded-[12px] p-5">
            <CardTitle>Step 2 — Map fields</CardTitle>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Match columns from your file to Transovo contact fields.
            </p>
            <Table className="mt-4 text-[13px]">
              <THead>
                <TR>
                  <TH>CSV column</TH>
                  <TH>Sample value</TH>
                  <TH>Transovo field</TH>
                </TR>
              </THead>
              <TBody>
                {fieldMappings.map((row) => (
                  <TR key={row.csvColumn}>
                    <TD className="font-mono text-[12px]">{row.csvColumn}</TD>
                    <TD className="text-muted-foreground">{row.sample}</TD>
                    <TD>
                      <Select
                        defaultValue={row.transovoField}
                        aria-label={`Map ${row.csvColumn}`}
                        className="h-9 rounded-[10px]"
                      >
                        <option value={row.transovoField}>{row.transovoField}</option>
                        <option value="Skip">Skip column</option>
                        <option value="Custom field">Custom field</option>
                      </Select>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card className="rounded-[12px] p-5">
            <CardTitle>Step 3 — Import settings</CardTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="import-list">Add to list</Label>
                <Select id="import-list" defaultValue="Leads" className="mt-1.5 h-10 rounded-[10px]">
                  <option value="Leads">Leads</option>
                  <option value="Customers">Customers</option>
                  <option value="VIP">VIP</option>
                  <option value="none">No list</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="import-tags">Apply tags</Label>
                <div className="mt-1.5 flex min-h-10 flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-card px-2 py-1.5">
                  {importTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                    >
                      {tag}
                      <X className="h-3 w-3 opacity-60" />
                    </span>
                  ))}
                  <input
                    id="import-tags"
                    className="min-w-[80px] flex-1 bg-transparent text-[13px] outline-none"
                    placeholder="Add tag…"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[10px] border border-border bg-muted/40 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-border"
                  defaultChecked
                  aria-describedby="consent-help"
                />
                <span>
                  <span className="block text-[13px] font-medium">
                    I confirm all imported contacts have provided express consent to receive SMS
                  </span>
                  <span id="consent-help" className="mt-1 block text-[12px] text-muted-foreground">
                    Required for TCPA compliance. Consent source and date columns must be mapped.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="rounded-[10px]">Start import</Button>
              <Button variant="outline" className="rounded-[10px]">
                Save mapping template
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="rounded-[12px] p-4">
            <CardTitle>Import checklist</CardTitle>
            <ul className="mt-4 space-y-3 text-[13px]">
              <li className="flex items-start gap-2">
                <StatusChip status="Complete" />
                <span>Phone numbers in E.164 or US format</span>
              </li>
              <li className="flex items-start gap-2">
                <StatusChip status="Complete" />
                <span>Consent date for each row</span>
              </li>
              <li className="flex items-start gap-2">
                <StatusChip status="Pending" />
                <span>Consent source documented</span>
              </li>
              <li className="flex items-start gap-2">
                <StatusChip status="Pending" />
                <span>No landlines or invalid numbers</span>
              </li>
            </ul>
          </Card>

          <Card className="rounded-[12px] p-4">
            <CardTitle>Need a template?</CardTitle>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Download our sample CSV with required consent columns.
            </p>
            <Button variant="outline" className="mt-4 w-full rounded-[10px]">
              <FileSpreadsheet className="h-4 w-4" />
              Download sample CSV
            </Button>
          </Card>
        </div>
      </div>

      <Card className="mt-5 rounded-[12px] p-4">
        <CardTitle>Import history</CardTitle>
        <Table className="mt-4 text-[13px]">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>File</TH>
              <TH>Imported by</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {importHistory.map((log) => (
              <TR key={log.id}>
                <TD className="text-muted-foreground">
                  {new Date(log.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </TD>
                <TD className="font-semibold">{log.file}</TD>
                <TD>{log.actor}</TD>
                <TD>
                  <StatusChip status={log.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
