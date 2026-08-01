"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import type { MessagingRegistration } from "@/lib/domain";
import { Building2, CheckCircle2, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { settingsTabs } from "@/lib/settings-tabs";

type Props = {
  workspaceName: string;
  registration: MessagingRegistration | null;
  complianceReady: boolean;
  lastSynced: string | null;
};

export function BusinessSettingsForm({
  workspaceName,
  registration,
  complianceReady,
  lastSynced,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const addressParts = [
    registration?.street,
    registration?.city && registration?.region
      ? `${registration.city}, ${registration.region} ${registration.postalCode || ""}`.trim()
      : registration?.city,
  ].filter(Boolean);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const accountName = String(form.get("accountName") || "").trim();

    try {
      if (accountName && accountName !== workspaceName) {
        const wsRes = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: accountName }),
        });
        const wsJson = await wsRes.json();
        if (!wsRes.ok) throw new Error(wsJson.error || "Failed to update workspace name");
      }

      const supportEmail = String(form.get("supportEmail") || "").trim();
      const businessPhone = String(form.get("businessPhone") || "").trim();
      const address = String(form.get("address") || "").trim();
      const addressLines = address.split("\n").map((l) => l.trim()).filter(Boolean);
      const street = addressLines[0] || registration?.street || "";
      const cityLine = addressLines[1] || "";
      const cityMatch = cityLine.match(/^([^,]+),\s*([A-Za-z]{2})\s*(.*)$/);

      const defaultAddress = addressParts.join("\n");
      const userEditedRegFields =
        supportEmail !== (registration?.contactEmail || "") ||
        businessPhone !== (registration?.contactPhone || "") ||
        address !== defaultAddress;

      // Only sync to compliance registration when the user edited profile fields.
      if (userEditedRegFields) {
        const regRes = await fetch("/api/messaging/registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_business",
            legalBusinessName: accountName || registration?.legalBusinessName || workspaceName,
            dbaName: registration?.dbaName || "",
            businessType: registration?.businessType || "llc",
            businessIndustry: registration?.businessIndustry || "other",
            businessIdentity: registration?.businessIdentity || "",
            businessRegistrationId: registration?.businessRegistrationId || "000000000",
            websiteUrl: registration?.websiteUrl || "https://example.com",
            street: street.length >= 2 ? street : registration?.street || "123 Main Street",
            city:
              (cityMatch?.[1]?.trim() || registration?.city || "").length >= 2
                ? cityMatch?.[1]?.trim() || registration?.city
                : "San Francisco",
            region:
              (cityMatch?.[2]?.trim() || registration?.region || "").length >= 2
                ? cityMatch?.[2]?.trim() || registration?.region
                : "CA",
            postalCode:
              (cityMatch?.[3]?.trim() || registration?.postalCode || "").length >= 3
                ? cityMatch?.[3]?.trim() || registration?.postalCode
                : "94102",
            country: registration?.country || "US",
            contactFirstName: registration?.contactFirstName || "Account",
            contactLastName: registration?.contactLastName || "Owner",
            contactEmail: supportEmail || registration?.contactEmail || "support@example.com",
            contactPhone: businessPhone || registration?.contactPhone || "+10000000000",
            contactTitle: registration?.contactTitle || "",
          }),
        });
        const regJson = await regRes.json();
        if (!regRes.ok) throw new Error(regJson.error || "Failed to save business profile");
      }

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Business settings"
        description="Account-level business information displayed in messages and compliance records."
        icon={Building2}
        iconTone="bg-blue-50 text-blue-600"
        actions={
          <Button type="submit" form="business-settings-form" className="rounded-[10px]" disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <Tabs items={settingsTabs} />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Card>
        <CardTitle>Account details</CardTitle>
        <form id="business-settings-form" className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
          <div>
            <Label htmlFor="accountName">Account name</Label>
            <Input id="accountName" name="accountName" defaultValue={workspaceName} />
          </div>
          <div>
            <Label htmlFor="timezone">Default timezone</Label>
            <Select id="timezone" name="timezone" defaultValue="America/Los_Angeles">
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="UTC">UTC</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="businessPhone">Business phone</Label>
            <Input
              id="businessPhone"
              name="businessPhone"
              defaultValue={registration?.contactPhone || ""}
            />
          </div>
          <div>
            <Label htmlFor="supportEmail">Support email</Label>
            <Input
              id="supportEmail"
              name="supportEmail"
              type="email"
              defaultValue={registration?.contactEmail || ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Business address</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={addressParts.join("\n")}
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
          <div
            className={`w-full shrink-0 rounded-[12px] border p-4 lg:max-w-[280px] ${
              complianceReady
                ? "border-emerald-200/80 bg-emerald-50/80"
                : "border-amber-200/80 bg-amber-50/80"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  complianceReady ? "text-emerald-600" : "text-amber-600"
                }`}
              />
              <div>
                <p
                  className={`text-[13px] font-semibold ${
                    complianceReady ? "text-emerald-900" : "text-amber-900"
                  }`}
                >
                  {complianceReady
                    ? "Compliance profile is up to date"
                    : "Compliance profile needs attention"}
                </p>
                <p
                  className={`mt-1 text-[12px] ${
                    complianceReady ? "text-emerald-800/80" : "text-amber-800/80"
                  }`}
                >
                  {lastSynced
                    ? `Last synced ${new Date(lastSynced).toLocaleString()}`
                    : "Complete your compliance profile in the compliance center"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
