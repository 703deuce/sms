"use client";

import { DEFAULT_SMS_CONSENT_TEXT } from "@/lib/appointments/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  MessageSquareText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div>
          <CardTitle className="text-[15px]">{title}</CardTitle>
          {description ? (
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function SavedIndicator({ show }: { show: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600 transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={!show}
    >
      <Check className="h-3.5 w-3.5" />
      Saved
    </span>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toUpperCase();
  const tone =
    normalized === "HIGH"
      ? "bg-red-50 text-red-700 ring-red-200"
      : normalized === "MEDIUM"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        tone,
      )}
    >
      {normalized}
    </span>
  );
}

const PROTECTION_MODES: Array<{
  value: "standard" | "strict" | "off";
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "Standard",
    description: "Challenge suspicious bookings with a confirmation step.",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Block high-risk bookings and challenge medium risk.",
  },
  {
    value: "off",
    label: "Off",
    description: "Accept all bookings without risk screening.",
  },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppointmentBookingSettingsClient({ workspaceSlug, workspaceName }: Props) {
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [businessDisplayName, setBusinessDisplayName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [consentText, setConsentText] = useState(DEFAULT_SMS_CONSENT_TEXT);
  const [termsUrl, setTermsUrl] = useState("/terms");
  const [privacyUrl, setPrivacyUrl] = useState("/privacy");
  const [bookingProtectionMode, setBookingProtectionMode] = useState<"standard" | "strict" | "off">("standard");
  const [suspiciousBookings, setSuspiciousBookings] = useState<
    Array<{
      id: string;
      at: string;
      serviceName?: string;
      riskLevel: string;
      action: string;
      signals: string[];
    }>
  >([]);
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
        setBookingProtectionMode(data.bookingProtection?.mode || "standard");
        setSuspiciousBookings(data.suspiciousBookings || []);
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

  if (loading) {
    return (
      <div className="max-w-3xl space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-muted/70" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface animate-pulse rounded-xl bg-card p-6">
            <div className="h-4 w-40 rounded-lg bg-muted" />
            <div className="mt-4 h-10 rounded-[10px] bg-muted/60" />
            <div className="mt-3 h-10 rounded-[10px] bg-muted/60" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Booking Page
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share a public link so customers can book {workspaceName} online.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            bookingEnabled
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-muted text-muted-foreground ring-border",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              bookingEnabled ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          {bookingEnabled ? "Live" : "Disabled"}
        </span>
      </div>

      {/* Public booking page */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-[15px]">Public booking page</CardTitle>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                {bookingEnabled
                  ? "Your booking page is live. Customers can book using your public link."
                  : "Booking is disabled — enable it when you're ready to go live."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 pl-11 sm:pl-0">
            <span className="text-[13px] font-medium text-foreground/80">
              {bookingEnabled ? "Enabled" : "Enable"}
            </span>
            <Toggle
              checked={bookingEnabled}
              disabled={saving || !workspaceSlug}
              label="Enable booking page"
              onChange={(next) => {
                setBookingEnabled(next);
                savePatch({ bookingEnabled: next });
              }}
            />
          </div>
        </div>

        {workspaceSlug ? (
          <div className="mt-5 border-t border-border/70 pt-5">
            <Label htmlFor="booking-url">Public URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  id="booking-url"
                  readOnly
                  value={bookingUrl}
                  className="bg-muted/40 pl-9 font-mono text-[13px] text-foreground/90"
                />
              </div>
              <Button variant="outline" onClick={copyLink} className="sm:min-w-28">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
            {bookingEnabled ? (
              <Link
                href={bookingPath}
                target="_blank"
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                Preview booking page
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[13px] leading-relaxed text-amber-800">
              Set a workspace slug in{" "}
              <Link href="/settings" className="font-semibold underline underline-offset-2">
                Settings → Branding
              </Link>{" "}
              before sharing a booking link.
            </p>
          </div>
        )}
      </Card>

      {/* Business info */}
      <Card className="p-6">
        <SectionHeader
          icon={Building2}
          title="Business info"
          description="Shown to customers on your public booking page."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={businessDisplayName}
              onChange={(e) => setBusinessDisplayName(e.target.value)}
              placeholder="Your business name"
            />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </div>
          <div>
            <Label htmlFor="phone">Business phone</Label>
            <Input
              id="phone"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="123 Main St, City, ST"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              savePatch({
                businessDisplayName,
                timezone,
                businessPhone,
                businessAddress,
              })
            }
          >
            {saving ? "Saving…" : "Save business info"}
          </Button>
          <SavedIndicator show={saved} />
        </div>
      </Card>

      {/* SMS consent & legal links */}
      <Card className="p-6">
        <SectionHeader
          icon={MessageSquareText}
          title="SMS consent & legal links"
          description="Compliance wording customers agree to when booking with SMS reminders."
        />
        <div className="space-y-4">
          <div>
            <Label htmlFor="consent-text">Consent wording on booking form</Label>
            <Textarea
              id="consent-text"
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              rows={3}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Displayed next to the SMS opt-in checkbox on your public booking page.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="terms-url">Terms of service URL</Label>
              <Input
                id="terms-url"
                value={termsUrl}
                onChange={(e) => setTermsUrl(e.target.value)}
                placeholder="/terms"
              />
            </div>
            <div>
              <Label htmlFor="privacy-url">Privacy policy URL</Label>
              <Input
                id="privacy-url"
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
                placeholder="/privacy"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => savePatch({ consentText, termsUrl, privacyUrl })}
          >
            {saving ? "Saving…" : "Save consent settings"}
          </Button>
          <SavedIndicator show={saved} />
        </div>
      </Card>

      {/* AI Booking Protection */}
      <Card className="p-6">
        <SectionHeader
          icon={ShieldCheck}
          title="AI Booking Protection"
          description="Screen public bookings for spam, bots, and suspicious patterns before they hit your calendar."
        />
        <div className="grid gap-2.5 sm:grid-cols-3">
          {PROTECTION_MODES.map((mode) => {
            const active = bookingProtectionMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  setBookingProtectionMode(mode.value);
                  savePatch({ bookingProtection: { mode: mode.value } });
                }}
                className={cn(
                  "rounded-[10px] border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/[0.04] shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    {mode.label}
                  </span>
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    {active ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                </span>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {mode.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Suspicious bookings review */}
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-[13px] font-semibold text-foreground">
              Suspicious bookings
            </h4>
            {suspiciousBookings.length > 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
                {suspiciousBookings.length} flagged
              </span>
            ) : null}
          </div>

          {suspiciousBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">
                No suspicious bookings
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Bookings flagged by AI Booking Protection will appear here for review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border">
              {suspiciousBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-2 bg-card px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {b.serviceName || "Booking"}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {formatDateTime(b.at)}
                      </span>
                    </p>
                    {b.signals?.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {b.signals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-medium capitalize text-muted-foreground">
                      {b.action}
                    </span>
                    <RiskBadge level={b.riskLevel} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
