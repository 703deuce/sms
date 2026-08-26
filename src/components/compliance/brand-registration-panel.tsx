"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import type { MessagingRegistration } from "@/lib/domain";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ComplianceRefreshButton } from "@/components/compliance/compliance-refresh-button";

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
  brandStatus: string;
};

export function BrandRegistrationPanel({ registration, brandStatus }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [brandName, setBrandName] = useState(
    registration?.dbaName || registration?.legalBusinessName || "",
  );
  const [website, setWebsite] = useState(registration?.websiteUrl || "");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(
    registration?.privacyPolicyUrl ||
      (registration?.websiteUrl
        ? `${registration.websiteUrl.replace(/\/$/, "")}/privacy`
        : ""),
  );
  const [brandDescription, setBrandDescription] = useState(
    registration?.businessIdentity || registration?.useCaseDescription || "",
  );
  const [vertical, setVertical] = useState(
    registration?.vertical || registration?.businessIndustry || "",
  );

  const businessComplete = Boolean(
    registration?.legalBusinessName &&
      registration?.businessType &&
      registration?.businessIndustry &&
      registration?.businessRegistrationId &&
      registration?.street &&
      registration?.city &&
      registration?.region &&
      registration?.postalCode &&
      registration?.contactFirstName &&
      registration?.contactLastName &&
      registration?.contactEmail &&
      registration?.contactPhone,
  );

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_business",
          legalBusinessName: registration?.legalBusinessName || "",
          dbaName: brandName.trim(),
          businessType: registration?.businessType || "",
          businessIndustry: registration?.businessIndustry || "",
          businessIdentity: brandDescription.trim(),
          businessRegistrationId: registration?.businessRegistrationId || "",
          websiteUrl: website.trim(),
          street: registration?.street || "",
          city: registration?.city || "",
          region: registration?.region || "",
          postalCode: registration?.postalCode || "",
          country: registration?.country || "US",
          contactFirstName: registration?.contactFirstName || "",
          contactLastName: registration?.contactLastName || "",
          contactEmail: registration?.contactEmail || "",
          contactPhone: registration?.contactPhone || "",
          contactTitle: registration?.contactTitle || undefined,
          privacyPolicyUrl: privacyPolicyUrl.trim() || undefined,
          vertical: vertical.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save brand");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save brand");
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!registration?.useCase?.trim()) {
      setError("Save your campaign use case on the Campaign tab before submitting for review.");
      return;
    }
    if ((registration?.sampleMessages?.length || 0) < 1) {
      setError("Add at least one sample message on the Campaign tab before submitting for review.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", certified: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit brand");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit brand");
    } finally {
      setSubmitting(false);
    }
  }

  const identityLabel =
    registration?.messagingProvider === "telnyx"
      ? registration?.brandStatusRaw || registration?.brandStatus || "Pending"
      : registration?.trustStatus === "approved"
        ? "Verified"
        : "Pending";

  const submittedAt = registration?.registrationSubmittedAt
    ? new Date(registration.registrationSubmittedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div>
      <PageHeader
        title="Brand registration"
        description="10DLC brand identity submitted to The Campaign Registry for carrier vetting."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={brandStatus} />
            <ComplianceRefreshButton />
            <Button type="submit" form="brand-registration-form" disabled={saving}>
              {saving ? "Saving…" : "Save brand"}
            </Button>
            <Button variant="outline" disabled={submitting} onClick={submitForReview}>
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {saved ? <p className="mb-4 text-sm text-violet-700">Brand details saved.</p> : null}

      {!businessComplete ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium text-amber-950">Complete business details first</p>
            <p className="mt-1 text-sm text-amber-900/80">
              Brand submission requires your legal business profile. Finish the{" "}
              <Link href="/compliance/business" className="underline">
                Business tab
              </Link>{" "}
              before submitting for carrier review.
            </p>
          </div>
        </div>
      ) : brandStatus === "Pending" ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium text-amber-950">Brand pending carrier review</p>
            <p className="mt-1 text-sm text-amber-900/80">
              Add your privacy policy URL and complete sample message requirements to avoid rejection.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Brand details</CardTitle>
          <form id="brand-registration-form" className="mt-4 space-y-4" onSubmit={saveBrand}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brandName">Brand name</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="brandId">Brand ID</Label>
                <Input
                  id="brandId"
                  defaultValue={registration?.brandId || registration?.brandSid || "—"}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="brandWebsite">Brand website</Label>
              <Input
                id="brandWebsite"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="privacyPolicy">Privacy policy URL</Label>
              <Input
                id="privacyPolicy"
                type="url"
                placeholder="https://example.com/privacy"
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="brandDescription">Brand description</Label>
              <Textarea
                id="brandDescription"
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="vertical">Vertical</Label>
              <Input
                id="vertical"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
              />
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Registration status</CardTitle>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusChip status={brandStatus} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{submittedAt}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Identity status</dt>
              <dd>{identityLabel}</dd>
            </div>
            {registration?.messagingProvider === "telnyx" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Carrier status</dt>
                <dd>{registration?.campaignStatusRaw || registration?.campaignStatus || "—"}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Brand ID</dt>
              <dd className="font-mono text-xs">
                {registration?.brandId || registration?.brandSid || "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-2 text-sm">Register your A2P campaign after brand approval.</p>
            <Link href="/compliance/campaign" className="mt-3 inline-flex">
              <Button variant="outline" size="sm">
                Campaign registration
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
