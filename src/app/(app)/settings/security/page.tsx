import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
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

const sessions = [
  { device: "Chrome on Windows", location: "San Francisco, CA", lastActive: "Active now", current: true },
  { device: "Safari on iPhone", location: "San Francisco, CA", lastActive: "2 hours ago", current: false },
];

export default function SettingsSecurityPage() {
  return (
    <div>
      <PageHeader
        title="Security"
        description="Password, two-factor authentication, and active sessions."
        actions={<Button variant="outline">Change password</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Two-factor authentication</CardTitle>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Authenticator app</p>
              <p className="text-xs text-muted-foreground">Not enabled</p>
            </div>
            <StatusChip status="Pending" />
          </div>
          <Button variant="outline" size="sm" className="mt-4">
            Enable 2FA
          </Button>
        </Card>

        <Card>
          <CardTitle>Login alerts</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="loginAlerts" defaultChecked className="rounded border-border" />
              <Label htmlFor="loginAlerts" className="mb-0">
                Email me on new device login
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="suspiciousAlerts" defaultChecked className="rounded border-border" />
              <Label htmlFor="suspiciousAlerts" className="mb-0">
                Alert on suspicious activity
              </Label>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Active sessions</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.device} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">
                  {session.device}
                  {session.current ? (
                    <span className="ml-2 text-xs text-primary">This device</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.location} · {session.lastActive}
                </p>
              </div>
              {!session.current ? (
                <Button variant="ghost" size="sm">
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-4">
          Sign out all other sessions
        </Button>
      </Card>

      <Card className="mt-4">
        <CardTitle>API access</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage API keys and webhook signing secrets in the integrations area.
        </p>
        <div className="mt-4">
          <Label htmlFor="webhookSecret">Webhook signing secret</Label>
          <Input id="webhookSecret" type="password" defaultValue="whsec_••••••••••••" readOnly className="mt-1.5 max-w-md font-mono" />
          <Button variant="outline" size="sm" className="mt-3">
            Rotate secret
          </Button>
        </div>
      </Card>
    </div>
  );
}
