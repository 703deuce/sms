import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import { Building2, CheckCircle2, Shield } from "lucide-react";
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
    <div className="space-y-5">
      <SectionHeader
        title="Business settings"
        description="Account-level business information displayed in messages and compliance records."
        icon={Building2}
        iconTone="bg-blue-50 text-blue-600"
        actions={
          <Button className="rounded-[10px]">Save changes</Button>
        }
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

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
                <Shield className="h-4 w-4" />
              </span>
              <CardTitle>Compliance profile</CardTitle>
            </div>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              A2P registration details are managed in the compliance center. Changes there sync
              to this account and appear on carrier registration records.
            </p>
            <Link href="/compliance" className="mt-4 inline-flex">
              <Button variant="outline" size="sm" className="rounded-[10px]">
                Edit compliance profile
              </Button>
            </Link>
          </div>
          <div className="w-full shrink-0 rounded-[12px] border border-emerald-200/80 bg-emerald-50/80 p-4 lg:max-w-[280px]">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-900">
                  Compliance profile is up to date
                </p>
                <p className="mt-1 text-[12px] text-emerald-800/80">
                  Last synced May 14, 2026 at 10:22 AM PT
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
