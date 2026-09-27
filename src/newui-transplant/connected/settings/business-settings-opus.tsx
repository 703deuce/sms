"use client";

import type { MessagingRegistration } from "@/lib/domain";
import { useBusinessSettings } from "@/lib/settings/use-business-settings";
import { FieldRow, Panel, Pill, Rows } from "@/newui-transplant/components/app/kit";
import { SaveBar } from "@/newui-transplant/components/app/save-bar";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Switch } from "@/newui-transplant/components/ui/switch";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";

type Props = {
  workspaceName: string;
  registration: MessagingRegistration | null;
  complianceReady: boolean;
  lastSynced: string | null;
};

function regPill(status: "approved" | "pending" | "rejected") {
  if (status === "approved") return <Pill tone="success">Approved</Pill>;
  if (status === "rejected") return <Pill tone="danger">Rejected</Pill>;
  return <Pill tone="warning">Pending</Pill>;
}

export function BusinessSettingsOpus({
  workspaceName: initialWorkspaceName,
  registration,
  complianceReady,
  lastSynced,
}: Props) {
  const s = useBusinessSettings({ initialWorkspaceName, registration });

  return (
    <form
      id="business-settings-form"
      onSubmit={(e) => void s.save(e)}
      className="space-y-6"
    >
      <div className="flex justify-end">
        <SaveBar
          label={s.saveState === "saving" ? "Saving…" : "Save changes"}
          onSave={() => s.save()}
        />
      </div>

      {s.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {s.error}
        </p>
      ) : null}

      <Panel title="Booking" description="Public booking availability for your workspace.">
        <FieldRow label="Booking enabled" description="When off, new public bookings are blocked.">
          <Switch
            checked={s.bookingEnabled}
            onCheckedChange={s.setBookingEnabled}
            disabled={s.platformLoading}
            aria-label="Booking enabled"
          />
        </FieldRow>
      </Panel>

      <Panel title="Business profile" description="Shown in messages and compliance records.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" value={s.workspaceName} onChange={(e) => s.setWorkspaceName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-email">Support email</Label>
            <Input id="support-email" type="email" value={s.supportEmail} onChange={(e) => s.setSupportEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-phone">Business phone</Label>
            <Input id="biz-phone" type="tel" value={s.businessPhone} onChange={(e) => s.setBusinessPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={3} value={s.address} onChange={(e) => s.setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={s.websiteUrl} onChange={(e) => s.setWebsiteUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={s.timezone} onChange={(e) => s.setTimezone(e.target.value)} />
          </div>
        </div>
      </Panel>

      <Panel title="Messaging registration" description="A2P brand and campaign status for business texting.">
        <Rows
          items={[
            { label: "Legal name", value: s.registrationCard.legalBusinessName },
            { label: "Brand", value: regPill(s.registrationCard.brandStatus) },
            { label: "Campaign", value: regPill(s.registrationCard.campaignStatus) },
            {
              label: "Messaging ready",
              value: complianceReady ? <Pill tone="success">Ready</Pill> : <Pill tone="warning">Not ready</Pill>,
            },
            { label: "Last synced", value: lastSynced ? new Date(lastSynced).toLocaleString() : "—" },
          ]}
        />
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/compliance">Open compliance</a>
          </Button>
        </div>
      </Panel>

      <Panel title="Public legal" description="URLs and SMS consent copy for booking and messaging surfaces.">
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="terms">Terms URL</Label>
            <Input id="terms" value={s.termsUrl} onChange={(e) => s.setTermsUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="privacy">Privacy URL</Label>
            <Input id="privacy" value={s.privacyUrl} onChange={(e) => s.setPrivacyUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consent-text">SMS consent text</Label>
            <Textarea id="consent-text" rows={4} value={s.consentText} onChange={(e) => s.setConsentText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consent-ver">Consent version</Label>
            <Input id="consent-ver" value={s.consentVersion} onChange={(e) => s.setConsentVersion(e.target.value)} />
          </div>
        </div>
      </Panel>

      <Panel title="Suspicious bookings" description="Recent bookings flagged for review.">
        {s.suspiciousBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suspicious bookings in the current window.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.suspiciousBookings.map((row) => (
                <TableRow key={`${row.at}-${row.email}`}>
                  <TableCell className="text-muted-foreground">{row.at}</TableCell>
                  <TableCell>{row.email || row.phone || "—"}</TableCell>
                  <TableCell>{row.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </form>
  );
}
