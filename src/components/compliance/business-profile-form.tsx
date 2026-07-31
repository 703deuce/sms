"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import type { MessagingRegistration } from "@/lib/domain";
import Link from "next/link";
import { useState } from "react";

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

type Props = {
  registration: MessagingRegistration | null;
  customerProfile: string;
};

export function BusinessProfileForm({ registration, customerProfile }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const contactName = String(form.get("contactName") || "").trim();
    const nameParts = contactName.split(/\s+/);
    const contactFirstName = nameParts[0] || "";
    const contactLastName = nameParts.slice(1).join(" ") || contactFirstName;

    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_business",
          legalBusinessName: form.get("legalName"),
          dbaName: form.get("dba"),
          businessType: form.get("entityType"),
          businessIndustry: form.get("industry"),
          businessIdentity: form.get("businessDescription"),
          businessRegistrationId: form.get("ein"),
          websiteUrl: form.get("website"),
          street: form.get("street"),
          city: form.get("city"),
          region: form.get("state"),
          postalCode: form.get("zip"),
          country: form.get("country"),
          contactFirstName,
          contactLastName,
          contactEmail: form.get("contactEmail"),
          contactPhone: form.get("contactPhone"),
          contactTitle: form.get("contactTitle"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save profile");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Business profile"
        description="Legal entity information required for A2P brand registration and carrier verification."
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={customerProfile} />
            <Button type="submit" form="business-profile-form" disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
            </Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {saved ? (
        <p className="mb-4 text-sm text-emerald-700">Business profile saved successfully.</p>
      ) : null}

      <form id="business-profile-form" onSubmit={saveProfile}>
        <Card>
          <CardTitle>Company information</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="legalName">Legal business name</Label>
              <Input
                id="legalName"
                name="legalName"
                defaultValue={registration?.legalBusinessName || ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="dba">DBA / trade name</Label>
              <Input id="dba" name="dba" defaultValue={registration?.dbaName || ""} />
            </div>
            <div>
              <Label htmlFor="ein">EIN / tax ID</Label>
              <Input
                id="ein"
                name="ein"
                defaultValue={registration?.businessRegistrationId || ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="entityType">Entity type</Label>
              <Select
                id="entityType"
                name="entityType"
                defaultValue={registration?.businessType || "llc"}
              >
                <option value="llc">LLC</option>
                <option value="corp">Corporation</option>
                <option value="sole">Sole proprietorship</option>
                <option value="nonprofit">Non-profit</option>
                <option value="partnership">Partnership</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select
                id="industry"
                name="industry"
                defaultValue={registration?.businessIndustry || "home-services"}
              >
                <option value="home-services">Home services</option>
                <option value="retail">Retail</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Financial services</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={registration?.websiteUrl || ""}
                required
              />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardTitle>Business address</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="street">Street address</Label>
              <Input id="street" name="street" defaultValue={registration?.street || ""} required />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={registration?.city || ""} required />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Select id="state" name="state" defaultValue={registration?.region || "CA"}>
                <option value="CA">California</option>
                <option value="NY">New York</option>
                <option value="TX">Texas</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="zip">ZIP code</Label>
              <Input id="zip" name="zip" defaultValue={registration?.postalCode || ""} required />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Select id="country" name="country" defaultValue={registration?.country || "US"}>
                <option value="US">United States</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardTitle>Primary contacts</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contactName">Authorized representative</Label>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={
                  [registration?.contactFirstName, registration?.contactLastName]
                    .filter(Boolean)
                    .join(" ") || ""
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={registration?.contactEmail || ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                defaultValue={registration?.contactPhone || ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="contactTitle">Title</Label>
              <Input
                id="contactTitle"
                name="contactTitle"
                defaultValue={registration?.contactTitle || ""}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="supportEmail">Support email (public-facing)</Label>
              <Input
                id="supportEmail"
                name="supportEmail"
                type="email"
                defaultValue={registration?.contactEmail || ""}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="businessDescription">Business description</Label>
              <Textarea
                id="businessDescription"
                name="businessDescription"
                defaultValue={registration?.businessIdentity || ""}
                rows={3}
              />
            </div>
          </div>
        </Card>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        This information must match your EIN records and website. Changes may require re-verification.{" "}
        <Link href="/settings/business" className="text-primary hover:underline">
          Account business settings
        </Link>
      </p>
    </div>
  );
}
