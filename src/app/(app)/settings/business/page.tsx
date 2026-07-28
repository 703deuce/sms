import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";

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

export default function SettingsBusinessPage() {
  return (
    <div>
      <PageHeader
        title="Business settings"
        description="Account-level business information displayed in messages and compliance records."
        actions={<Button>Save changes</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <CardTitle>Account details</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="accountName">Account name</Label>
            <Input id="accountName" defaultValue="Harbor Home Services" />
          </div>
          <div>
            <Label htmlFor="timezone">Default timezone</Label>
            <Select id="timezone" defaultValue="America/Los_Angeles">
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="UTC">UTC</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="businessPhone">Business phone</Label>
            <Input id="businessPhone" defaultValue="+1 (415) 555-0142" />
          </div>
          <div>
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" defaultValue="support@harborhome.co" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Business address</Label>
            <Textarea
              id="address"
              defaultValue={"1200 Bay Street, Suite 400\nSan Francisco, CA 94109"}
              rows={3}
            />
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Compliance profile</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          A2P registration details are managed in the compliance center. Changes there sync to this account.
        </p>
        <Link href="/compliance/business" className="mt-4 inline-flex">
          <Button variant="outline" size="sm">
            Edit compliance profile
          </Button>
        </Link>
      </Card>
    </div>
  );
}
