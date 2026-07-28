import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { forms } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import {
  CheckSquare,
  ExternalLink,
  FileInput,
  Mail,
  Phone,
  Plus,
  Type,
  User,
} from "lucide-react";
import Link from "next/link";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

const builderFields = [
  {
    icon: Phone,
    label: "Phone number",
    description: "Required for SMS opt-in. Validated and formatted automatically.",
    required: true,
  },
  {
    icon: User,
    label: "First name",
    description: "Optional personalization field stored on the contact record.",
    required: false,
  },
  {
    icon: Mail,
    label: "Email",
    description: "Optional secondary contact method for cross-channel follow-up.",
    required: false,
  },
  {
    icon: Type,
    label: "Custom text field",
    description: "Capture company name, referral source, or other free-form data.",
    required: false,
  },
  {
    icon: CheckSquare,
    label: "Consent checkbox",
    description: "Required TCPA consent with customizable disclosure language.",
    required: true,
  },
  {
    icon: FileInput,
    label: "Hidden UTM fields",
    description: "Track campaign source, medium, and content from embed URL params.",
    required: false,
  },
];

export default function FormsPage() {
  const totalSubmissions = forms.reduce((sum, f) => sum + f.submissions, 0);

  return (
    <div>
      <PageHeader
        title="Opt-in forms"
        description="Embed compliant signup forms on your website to grow your SMS subscriber list."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create form
          </Button>
        }
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active forms" value={formatNumber(forms.length)} />
        <StatCard label="Total submissions" value={formatNumber(totalSubmissions)} />
        <StatCard label="Conversion rate" value="34.2%" hint="Views to submissions (30d)" />
      </div>

      <Card className="mb-6">
        <CardTitle>All forms</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>List</TH>
                <TH>Submissions</TH>
                <TH>Status</TH>
                <TH>URL</TH>
              </TR>
            </THead>
            <TBody>
              {forms.map((form) => (
                <TR key={form.id}>
                  <TD className="font-medium">{form.name}</TD>
                  <TD>{form.list}</TD>
                  <TD>{formatNumber(form.submissions)}</TD>
                  <TD>
                    <StatusChip status={form.status} />
                  </TD>
                  <TD>
                    <a
                      href={form.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Form builder fields</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag fields into your form or use the default compliant layout.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builderFields.map((field) => {
            const Icon = field.icon;
            return (
              <div
                key={field.label}
                className="rounded-xl border border-border bg-muted/30 p-4 transition hover:border-primary/40"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{field.label}</p>
                      {field.required ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                          Required
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Link href="/grow/pages">
            <Button variant="outline" size="sm">
              View hosted signup pages
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
