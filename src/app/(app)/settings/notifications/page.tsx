import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";

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

const notificationGroups = [
  {
    title: "Campaign activity",
    items: [
      { id: "campComplete", label: "Campaign completed", email: true, inApp: true },
      { id: "campFailed", label: "Campaign failed or partially delivered", email: true, inApp: true },
      { id: "campScheduled", label: "Campaign scheduled reminder", email: false, inApp: true },
    ],
  },
  {
    title: "Inbox",
    items: [
      { id: "newReply", label: "New inbound reply", email: true, inApp: true },
      { id: "unassigned", label: "Unassigned conversation alert", email: false, inApp: true },
      { id: "assigned", label: "Conversation assigned to me", email: true, inApp: true },
    ],
  },
  {
    title: "Compliance & account",
    items: [
      { id: "a2pStatus", label: "A2P registration status change", email: true, inApp: true },
      { id: "lowBalance", label: "Low credit balance warning", email: true, inApp: true },
      { id: "teamInvite", label: "Team member invited or joined", email: true, inApp: false },
    ],
  },
];

export default function SettingsNotificationsPage() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Choose how you receive alerts for campaigns, inbox, and account events."
        actions={<Button>Save preferences</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card className="mb-4">
        <CardTitle>Delivery preferences</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 max-w-xl">
          <div>
            <Label htmlFor="notifyEmail">Notification email</Label>
            <Input id="notifyEmail" type="email" defaultValue="alex@harborhome.co" />
          </div>
          <div>
            <Label htmlFor="digestFrequency">Email digest</Label>
            <Select id="digestFrequency" defaultValue="daily">
              <option value="realtime">Real-time</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
              <option value="off">Off</option>
            </Select>
          </div>
        </form>
      </Card>

      {notificationGroups.map((group) => (
        <Card key={group.title} className="mt-4">
          <CardTitle>{group.title}</CardTitle>
          <ul className="mt-4 divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium">{item.label}</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" defaultChecked={item.email} className="rounded border-border" />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" defaultChecked={item.inApp} className="rounded border-border" />
                    In-app
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
