import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
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

export default function SettingsMessagingPage() {
  return (
    <div>
      <PageHeader
        title="Messaging settings"
        description="Quiet hours, compliance footers, STOP handling, and send limits for your workspace."
        actions={<Button>Save settings</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Quiet hours</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="quietEnabled" defaultChecked className="rounded border-border" />
              <Label htmlFor="quietEnabled" className="mb-0">
                Enforce quiet hours for campaigns
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quietStart">Start time</Label>
                <Input id="quietStart" type="time" defaultValue="21:00" />
              </div>
              <div>
                <Label htmlFor="quietEnd">End time</Label>
                <Input id="quietEnd" type="time" defaultValue="08:00" />
              </div>
            </div>
            <div>
              <Label htmlFor="quietTimezone">Timezone</Label>
              <Select id="quietTimezone" defaultValue="America/Los_Angeles">
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
              </Select>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Compliance footer</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="footer">Default message footer</Label>
              <Textarea
                id="footer"
                defaultValue="Msg&data rates may apply. Reply STOP to opt out."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="appendFooter" defaultChecked className="rounded border-border" />
              <Label htmlFor="appendFooter" className="mb-0">
                Append footer to all campaign messages
              </Label>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>STOP &amp; HELP</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="stopResponse">STOP confirmation</Label>
              <Textarea
                id="stopResponse"
                defaultValue="You have been unsubscribed and will receive no further messages from Harbor Home."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="helpResponse">HELP response</Label>
              <Textarea
                id="helpResponse"
                defaultValue="Harbor Home SMS support: support@harborhome.co or (415) 555-0142. Reply STOP to opt out."
                rows={2}
              />
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>MMS &amp; limits</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mmsEnabled" defaultChecked className="rounded border-border" />
              <Label htmlFor="mmsEnabled" className="mb-0">
                Enable MMS sending
              </Label>
            </div>
            <div>
              <Label htmlFor="maxSegments">Max segments per message</Label>
              <Input id="maxSegments" type="number" defaultValue={3} min={1} max={10} />
            </div>
            <div>
              <Label htmlFor="linkShortener">Link shortener domain</Label>
              <Select id="linkShortener" defaultValue="trnv.io">
                <option value="trnv.io">trnv.io (default)</option>
                <option value="custom">Custom domain</option>
              </Select>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
