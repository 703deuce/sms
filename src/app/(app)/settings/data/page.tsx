import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";

const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

export default function SettingsDataPage() {
  return (
    <div>
      <PageHeader
        title="Data & privacy"
        description="Export account data, retention settings, and account deletion."
        actions={<Button variant="outline">Export all data</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <CardTitle>Data export</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Download a copy of your contacts, campaigns, message logs, and consent records as CSV or JSON.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            Export contacts
          </Button>
          <Button variant="outline" size="sm">
            Export message logs
          </Button>
          <Button variant="outline" size="sm">
            Export consent records
          </Button>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>Retention settings</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 max-w-xl">
          <div>
            <Label htmlFor="messageRetention">Message log retention</Label>
            <Select id="messageRetention" defaultValue="365">
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="consentRetention">Consent record retention</Label>
            <Select id="consentRetention" defaultValue="forever">
              <option value="forever">Indefinite (recommended)</option>
              <option value="365">1 year after unsubscribe</option>
              <option value="730">2 years after unsubscribe</option>
            </Select>
          </div>
        </form>
        <Button type="button" size="sm" className="mt-4">
          Save retention settings
        </Button>
      </Card>

      <Card className="mt-4">
        <CardTitle>Privacy & compliance</CardTitle>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>Contact data is stored in US data centers with encryption at rest.</li>
          <li>Consent records are retained for TCPA and carrier audit requirements.</li>
          <li>Suppression lists (STOP, blocks) are never deleted while account is active.</li>
          <li>Data processing agreement available on request for enterprise accounts.</li>
        </ul>
      </Card>

      <Card className="mt-4 border-red-200">
        <CardTitle className="text-red-900">Delete account</CardTitle>
        <div className="mt-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          <div>
            <p className="text-sm font-medium text-red-950">Permanent account deletion</p>
            <p className="mt-1 text-sm text-red-900/80">
              This will release all phone numbers, delete contacts and message history, and cancel your subscription.
              This action cannot be undone.
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" className="mt-4">
          Request account deletion
        </Button>
      </Card>
    </div>
  );
}
