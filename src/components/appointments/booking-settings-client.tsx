"use client";

import { DEFAULT_SMS_CONSENT_TEXT } from "@/lib/appointments/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
};

export function AppointmentBookingSettingsClient({ workspaceSlug, workspaceName }: Props) {
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [businessDisplayName, setBusinessDisplayName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [consentText, setConsentText] = useState(DEFAULT_SMS_CONSENT_TEXT);
  const [termsUrl, setTermsUrl] = useState("/terms");
  const [privacyUrl, setPrivacyUrl] = useState("/privacy");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookingPath = workspaceSlug ? `/book/${workspaceSlug}` : "";
  const bookingUrl =
    typeof window !== "undefined" && bookingPath
      ? `${window.location.origin}${bookingPath}`
      : bookingPath;

  useEffect(() => {
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || {};
        setBookingEnabled(Boolean(data.bookingEnabled));
        setTimezone(data.timezone || "America/New_York");
        setBusinessDisplayName(data.businessDisplayName || json.workspace?.name || workspaceName);
        setBusinessPhone(data.businessPhone || "");
        setBusinessAddress(data.businessAddress || "");
        setConsentText(data.consentText || DEFAULT_SMS_CONSENT_TEXT);
        setTermsUrl(data.termsUrl || "/terms");
        setPrivacyUrl(data.privacyUrl || "/privacy");
      })
      .finally(() => setLoading(false));
  }, [workspaceName]);

  async function savePatch(patch: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
  }

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading booking settings…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Booking Page</h1>
        <p className="mt-1 text-sm text-slate-500">
          Share a public link so customers can book {workspaceName} online.
        </p>
      </div>

      <Card className="rounded-xl border-slate-200 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Public booking page</p>
            <p className="text-sm text-slate-500">
              {bookingEnabled
                ? "Customers can book using your public link."
                : "Booking is disabled — enable when you are ready to go live."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={bookingEnabled}
              disabled={saving || !workspaceSlug}
              onChange={(e) => {
                setBookingEnabled(e.target.checked);
                savePatch({ bookingEnabled: e.target.checked });
              }}
            />
            Enable booking page
          </label>
        </div>

        {workspaceSlug ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="booking-url">Public URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="booking-url" readOnly value={bookingUrl} />
              <Button variant="outline" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            {bookingEnabled ? (
              <Link href={bookingPath} target="_blank" className="text-sm text-sky-700 hover:underline">
                Preview booking page →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-700">
            Set a workspace slug in Settings → Branding before sharing a booking link.
          </p>
        )}
      </Card>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-4 font-semibold text-slate-900">Business info on booking page</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={businessDisplayName}
              onChange={(e) => setBusinessDisplayName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Business phone</Label>
            <Input id="phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            disabled={saving}
            onClick={() =>
              savePatch({
                businessDisplayName,
                businessPhone,
                businessAddress,
                timezone,
              })
            }
          >
            {saving ? "Saving…" : "Save business info"}
          </Button>
          {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        </div>
      </Card>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-4 font-semibold text-slate-900">SMS consent & legal links</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="consent-text">Consent wording on booking form</Label>
            <Textarea
              id="consent-text"
              rows={3}
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="terms-url">Terms URL</Label>
              <Input id="terms-url" value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="privacy-url">Privacy URL</Label>
              <Input
                id="privacy-url"
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            disabled={saving}
            onClick={() =>
              savePatch({
                consentText,
                termsUrl,
                privacyUrl,
              })
            }
          >
            {saving ? "Saving…" : "Save consent settings"}
          </Button>
          {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        </div>
      </Card>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">Before you launch</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Create at least one appointment type.</li>
          <li>
            Connect a calendar on{" "}
            <Link href="/voice/calendars" className="text-sky-700 hover:underline">
              Calendar connections
            </Link>
            .
          </li>
          <li>Review reminder templates under Reminder Settings.</li>
          <li>Ensure SMS compliance and a sending number are configured.</li>
        </ul>
      </Card>
    </div>
  );
}
