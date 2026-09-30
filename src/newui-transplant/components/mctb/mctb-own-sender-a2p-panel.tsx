"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfigSection } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import { FileText } from "lucide-react";
type MctbOwnSenderA2pIntake = {
  status: string;
  legalBusinessName: string;
  einOrTaxId: string;
  businessWebsite: string;
  businessAddressLine1: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  contactEmail: string;
  contactPhone: string;
  desiredAreaCode: string;
  useCaseDescription: string;
  submittedAt?: string | null;
};

export function MctbOwnSenderA2pPanel() {
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [intake, setIntake] = useState<MctbOwnSenderA2pIntake | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/own-sender-a2p", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load registration");
      setEntitled(Boolean(json.data.entitled));
      if (json.data.intake) setIntake(json.data.intake as MctbOwnSenderA2pIntake);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not load registration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(partial: Partial<MctbOwnSenderA2pIntake>) {
    setIntake((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function save(submit: boolean) {
    if (!intake) return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/mctb/own-sender-a2p", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...intake, submit }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors as Record<string, string>);
        throw new Error(json.error || "Save failed");
      }
      setEntitled(Boolean(json.data.entitled));
      setIntake(json.data.intake as MctbOwnSenderA2pIntake);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading A2P registration…</p>;
  }

  if (!entitled) {
    return (
      <ConfigSection
        icon={FileText}
        title="Own number — A2P registration"
        description="After you subscribe to Own Local Number, complete this form. Transovo submits your carrier registration manually — approval is not automatic."
      >
        <p className="text-sm text-muted-foreground">
          Add Own Local Number from Settings → Billing. Checkout includes a one-time $19.50 A2P registration
          fee plus $10/month for your dedicated local texting number.
        </p>
      </ConfigSection>
    );
  }

  if (!intake) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {formError || "Could not load registration."}
      </p>
    );
  }

  const submitted = intake.status === "submitted";

  return (
    <ConfigSection
      icon={FileText}
      title="Own number — A2P registration"
      description="Save your business details here. Transovo reviews and submits A2P registration to the carrier for you — you do not need to complete carrier portals yourself."
    >
      {submitted ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Submitted {intake.submittedAt ? new Date(intake.submittedAt).toLocaleString() : ""}. Transovo
          will process your registration and update messaging status when the carrier approves.
        </p>
      ) : null}
      {formError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">{formError}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="a2p-legal-name">Legal business name</Label>
          <Input
            id="a2p-legal-name"
            className="mt-1"
            value={intake.legalBusinessName}
            disabled={submitted}
            onChange={(e) => patch({ legalBusinessName: e.target.value })}
          />
          {fieldErrors.legalBusinessName ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.legalBusinessName}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="a2p-ein">EIN / tax ID (optional)</Label>
          <Input
            id="a2p-ein"
            className="mt-1"
            value={intake.einOrTaxId}
            disabled={submitted}
            onChange={(e) => patch({ einOrTaxId: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a2p-website">Business website</Label>
          <Input
            id="a2p-website"
            className="mt-1"
            value={intake.businessWebsite}
            disabled={submitted}
            onChange={(e) => patch({ businessWebsite: e.target.value })}
            placeholder="https://"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="a2p-address">Street address</Label>
          <Input
            id="a2p-address"
            className="mt-1"
            value={intake.businessAddressLine1}
            disabled={submitted}
            onChange={(e) => patch({ businessAddressLine1: e.target.value })}
          />
          {fieldErrors.businessAddressLine1 ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.businessAddressLine1}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="a2p-city">City</Label>
          <Input
            id="a2p-city"
            className="mt-1"
            value={intake.businessCity}
            disabled={submitted}
            onChange={(e) => patch({ businessCity: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a2p-state">State</Label>
          <Input
            id="a2p-state"
            className="mt-1"
            value={intake.businessState}
            disabled={submitted}
            onChange={(e) => patch({ businessState: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a2p-zip">Postal code</Label>
          <Input
            id="a2p-zip"
            className="mt-1"
            value={intake.businessPostalCode}
            disabled={submitted}
            onChange={(e) => patch({ businessPostalCode: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="a2p-area">Preferred area code</Label>
          <Input
            id="a2p-area"
            className="mt-1"
            value={intake.desiredAreaCode}
            disabled={submitted}
            onChange={(e) => patch({ desiredAreaCode: e.target.value })}
            placeholder="e.g. 415"
          />
        </div>
        <div>
          <Label htmlFor="a2p-contact-email">Contact email</Label>
          <Input
            id="a2p-contact-email"
            type="email"
            className="mt-1"
            value={intake.contactEmail}
            disabled={submitted}
            onChange={(e) => patch({ contactEmail: e.target.value })}
          />
          {fieldErrors.contactEmail ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.contactEmail}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="a2p-contact-phone">Contact phone</Label>
          <Input
            id="a2p-contact-phone"
            className="mt-1"
            value={intake.contactPhone}
            disabled={submitted}
            onChange={(e) => patch({ contactPhone: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="a2p-use-case">How will you text customers?</Label>
          <Textarea
            id="a2p-use-case"
            className="mt-1 min-h-[4.5rem]"
            value={intake.useCaseDescription}
            disabled={submitted}
            onChange={(e) => patch({ useCaseDescription: e.target.value })}
            placeholder="Missed-call follow-up, appointment reminders, etc."
          />
          {fieldErrors.useCaseDescription ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.useCaseDescription}</p>
          ) : null}
        </div>
      </div>
      {!submitted ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>
            Save draft
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save(true)}>
            Submit for Transovo review
          </Button>
        </div>
      ) : null}
    </ConfigSection>
  );
}
