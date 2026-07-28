import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { auditLogs } from "@/lib/mock/data";
import { FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

const fieldMappings = [
  { csvColumn: "first_name", transovoField: "First name", sample: "Maya" },
  { csvColumn: "last_name", transovoField: "Last name", sample: "Chen" },
  { csvColumn: "mobile", transovoField: "Phone", sample: "+14155550101" },
  { csvColumn: "email_address", transovoField: "Email", sample: "maya.chen@email.com" },
  { csvColumn: "opt_in_date", transovoField: "Consent date", sample: "2026-03-12" },
  { csvColumn: "source", transovoField: "Consent source", sample: "Web form" },
];

const importHistory = auditLogs.filter((log) => log.event === "Contact import");

export default function ContactImportsPage() {
  return (
    <div>
      <PageHeader
        title="Imports"
        description="Upload opted-in contacts with field mapping and consent confirmation."
        actions={
          <Link href="/contacts">
            <Button variant="outline">View all contacts</Button>
          </Link>
        }
      />

      <Tabs items={contactTabs} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Step 1 — Upload file</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV or XLSX with phone numbers and documented consent for each contact.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <Upload className="h-10 w-10 text-primary" />
              <p className="mt-3 font-medium">Drag and drop your file here</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
              <Button variant="outline" className="mt-4">
                Choose file
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Sample file: leads-june.csv · 214 rows · 6 columns
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>Step 2 — Map fields</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Match columns from your file to Transovo contact fields.
            </p>
            <Table className="mt-4">
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
                    <TD className="font-mono text-xs">{row.csvColumn}</TD>
                    <TD className="text-muted-foreground">{row.sample}</TD>
                    <TD>
                      <Select defaultValue={row.transovoField} aria-label={`Map ${row.csvColumn}`}>
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

          <Card>
            <CardTitle>Step 3 — Import settings</CardTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="import-list">Add to list</Label>
                <Select id="import-list" defaultValue="Leads">
                  <option value="Leads">Leads</option>
                  <option value="Customers">Customers</option>
                  <option value="VIP">VIP</option>
                  <option value="none">No list</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="import-tags">Apply tags</Label>
                <Input id="import-tags" placeholder="sms-opt-in, import-july" />
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-border"
                  defaultChecked
                  aria-describedby="consent-help"
                />
                <span>
                  <span className="block text-sm font-medium">
                    I confirm all imported contacts have provided express consent to receive SMS
                  </span>
                  <span id="consent-help" className="mt-1 block text-xs text-muted-foreground">
                    Required for TCPA compliance. Consent source and date columns must be mapped.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <Button>Start import</Button>
              <Button variant="outline">Save mapping template</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Import checklist</CardTitle>
            <ul className="mt-4 space-y-3 text-sm">
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

          <Card>
            <CardTitle>Need a template?</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Download our sample CSV with required consent columns.
            </p>
            <Button variant="outline" className="mt-4 w-full">
              <FileSpreadsheet className="h-4 w-4" />
              Download sample CSV
            </Button>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardTitle>Import history</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>File</TH>
              <TH>Imported by</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {importHistory.length > 0 ? (
              importHistory.map((log) => (
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
                  <TD className="font-medium">{log.detail}</TD>
                  <TD>{log.actor}</TD>
                  <TD>
                    <StatusChip status="Completed" />
                  </TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={4} className="text-center text-muted-foreground">
                  No imports yet
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
