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
  brandStatus: string;
};

export function BrandRegistrationPanel({ registration, brandStatus }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitForReview() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit brand");
    } finally {
      setSubmitting(false);
    }
  }

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
          <div className="flex items-center gap-2">
            <StatusChip status={brandStatus} />
            <Button disabled={submitting} onClick={submitForReview}>
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {brandStatus === "Pending" ? (
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
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brandName">Brand name</Label>
                <Input
                  id="brandName"
                  defaultValue={registration?.dbaName || registration?.legalBusinessName || ""}
                  readOnly
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
              <Input id="brandWebsite" defaultValue={registration?.websiteUrl || ""} readOnly />
            </div>
            <div>
              <Label htmlFor="privacyPolicy">Privacy policy URL</Label>
              <Input
                id="privacyPolicy"
                placeholder="https://example.com/privacy"
                defaultValue={
                  registration?.websiteUrl
                    ? `${registration.websiteUrl.replace(/\/$/, "")}/privacy`
                    : ""
                }
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="brandDescription">Brand description</Label>
              <Textarea
                id="brandDescription"
                defaultValue={registration?.businessIdentity || registration?.useCaseDescription || ""}
                rows={3}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="vertical">Vertical</Label>
              <Input id="vertical" defaultValue={registration?.vertical || registration?.businessIndustry || ""} readOnly />
            </div>
          </div>
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
              <dd>{registration?.trustStatus === "approved" ? "Verified" : "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Trust score</dt>
              <dd>—</dd>
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
