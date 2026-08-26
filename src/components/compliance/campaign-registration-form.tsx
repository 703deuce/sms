"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import type { MessagingRegistration } from "@/lib/domain";
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
  campaignStatus: string;
};

export function CampaignRegistrationForm({ registration, campaignStatus }: Props) {
  const router = useRouter();
  const samples = registration?.sampleMessages || [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const sampleMessages = [
      String(form.get("sample1") || "").trim(),
      String(form.get("sample2") || "").trim(),
      String(form.get("sample3") || "").trim(),
    ].filter((s) => s.length >= 10);

    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_use_case",
          useCase: form.get("useCase"),
          useCaseDescription: form.get("campaignDescription"),
          sampleMessages,
          optInDescription: form.get("messageFlow"),
          helpMessage: form.get("helpMessage"),
          stopMessage: form.get("optOutMessage"),
          messageVolume: form.get("dailyVolume"),
          vertical: form.get("vertical"),
          campaignDisplayName: String(form.get("campaignName") || "").trim() || undefined,
          optInKeywords: String(form.get("optInKeywords") || "").trim() || undefined,
          optOutKeywords: String(form.get("optOutKeywords") || "").trim() || undefined,
          helpKeywords: String(form.get("helpKeywords") || "").trim() || undefined,
          optInFormUrl: String(form.get("optInFormUrl") || "").trim() || undefined,
          privacyPolicyUrl: String(form.get("privacyPolicyUrl") || "").trim() || undefined,
          subscriberOptIn: form.get("subscriberOptIn") === "yes",
          subscriberOptOut: form.get("subscriberOptOut") === "yes",
          embeddedLinks: form.get("embeddedLinks") === "yes",
          embeddedPhone: form.get("embeddedPhone") === "yes",
          ageGated: form.get("ageGated") === "yes",
          directLending: form.get("directLending") === "yes",
          affiliateMarketing: form.get("affiliateMarketing") === "yes",
          numberPoolSize: Number(form.get("numberPool") || 1) || 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save campaign");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  async function submitCampaign() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", certified: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit campaign");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaign registration"
        description="Register your A2P 10DLC campaign use case, sample messages, and opt-in workflow with carriers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={campaignStatus} />
            <ComplianceRefreshButton />
            <Button type="submit" form="campaign-registration-form" disabled={saving}>
              {saving ? "Saving…" : "Save campaign"}
            </Button>
            <Button variant="outline" disabled={saving} onClick={submitCampaign}>
              Submit campaign
            </Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {saved ? (
        <p className="mb-4 text-sm text-violet-700">Campaign registration saved.</p>
      ) : null}

      <form id="campaign-registration-form" onSubmit={saveCampaign}>
        <Card>
          <CardTitle>Campaign identity</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="campaignName">Campaign name</Label>
              <Input
                id="campaignName"
                name="campaignName"
                defaultValue={
                  registration?.campaignDisplayName ||
                  registration?.dbaName ||
                  registration?.legalBusinessName ||
                  ""
                }
              />
            </div>
            <div>
              <Label htmlFor="useCase">Use case</Label>
              <Select id="useCase" name="useCase" defaultValue={registration?.useCase || "customer-care"}>
                <option value="customer-care">Customer care</option>
                <option value="marketing">Marketing</option>
                <option value="mixed">Mixed</option>
                <option value="account-notifications">Account notifications</option>
                <option value="delivery-notifications">Delivery notifications</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="campaignDescription">Campaign description</Label>
              <Textarea
                id="campaignDescription"
                name="campaignDescription"
                defaultValue={registration?.useCaseDescription || ""}
                rows={3}
                required
              />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardTitle>Sample messages</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Provide 2–5 representative messages that reflect actual content you will send.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="sample1">Sample message 1</Label>
              <Textarea id="sample1" name="sample1" defaultValue={samples[0] || ""} rows={2} />
            </div>
            <div>
              <Label htmlFor="sample2">Sample message 2</Label>
              <Textarea id="sample2" name="sample2" defaultValue={samples[1] || ""} rows={2} />
            </div>
            <div>
              <Label htmlFor="sample3">Sample message 3</Label>
              <Textarea id="sample3" name="sample3" defaultValue={samples[2] || ""} rows={2} />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardTitle>Opt-in &amp; message flow</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="messageFlow">Message flow / opt-in description</Label>
              <Textarea
                id="messageFlow"
                name="messageFlow"
                defaultValue={registration?.optInDescription || ""}
                rows={4}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="optInKeywords">Opt-in keywords</Label>
                <Input
                  id="optInKeywords"
                  name="optInKeywords"
                  defaultValue={registration?.optInKeywords || "JOIN, START, YES"}
                />
              </div>
              <div>
                <Label htmlFor="optOutKeywords">Opt-out keywords</Label>
                <Input
                  id="optOutKeywords"
                  name="optOutKeywords"
                  defaultValue={registration?.optOutKeywords || "STOP, END, CANCEL, UNSUBSCRIBE"}
                />
              </div>
              <div>
                <Label htmlFor="helpKeywords">Help keywords</Label>
                <Input
                  id="helpKeywords"
                  name="helpKeywords"
                  defaultValue={registration?.helpKeywords || "HELP, INFO"}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="optInFormUrl">Opt-in form URL</Label>
                <Input
                  id="optInFormUrl"
                  name="optInFormUrl"
                  defaultValue={registration?.optInFormUrl || registration?.websiteUrl || ""}
                />
              </div>
              <div>
                <Label htmlFor="privacyPolicyUrl">Privacy policy URL</Label>
                <Input
                  id="privacyPolicyUrl"
                  name="privacyPolicyUrl"
                  placeholder="https://example.com/privacy"
                  defaultValue={registration?.privacyPolicyUrl || ""}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="helpMessage">Help message response</Label>
              <Textarea
                id="helpMessage"
                name="helpMessage"
                defaultValue={registration?.helpMessage || ""}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="optOutMessage">Opt-out confirmation message</Label>
              <Textarea
                id="optOutMessage"
                name="optOutMessage"
                defaultValue={registration?.stopMessage || ""}
                rows={2}
              />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardTitle>Campaign attributes</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subscriberOptIn">Subscriber opt-in</Label>
              <Select
                id="subscriberOptIn"
                name="subscriberOptIn"
                defaultValue={registration?.subscriberOptIn === false ? "no" : "yes"}
              >
                <option value="yes">Yes — explicit consent required</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="subscriberOptOut">Subscriber opt-out</Label>
              <Select
                id="subscriberOptOut"
                name="subscriberOptOut"
                defaultValue={registration?.subscriberOptOut === false ? "no" : "yes"}
              >
                <option value="yes">Yes — STOP supported</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="embeddedLinks">Embedded links</Label>
              <Select
                id="embeddedLinks"
                name="embeddedLinks"
                defaultValue={registration?.embeddedLinks === false ? "no" : "yes"}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="embeddedPhone">Embedded phone numbers</Label>
              <Select
                id="embeddedPhone"
                name="embeddedPhone"
                defaultValue={registration?.embeddedPhone ? "yes" : "no"}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ageGated">Age-gated content</Label>
              <Select
                id="ageGated"
                name="ageGated"
                defaultValue={registration?.ageGated ? "yes" : "no"}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="directLending">Direct lending</Label>
              <Select
                id="directLending"
                name="directLending"
                defaultValue={registration?.directLending ? "yes" : "no"}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="affiliateMarketing">Affiliate marketing</Label>
              <Select
                id="affiliateMarketing"
                name="affiliateMarketing"
                defaultValue={registration?.affiliateMarketing ? "yes" : "no"}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="numberPool">Number pool size</Label>
              <Input
                id="numberPool"
                name="numberPool"
                type="number"
                defaultValue={registration?.numberPoolSize || 1}
                min={1}
              />
            </div>
            <div>
              <Label htmlFor="dailyVolume">Estimated daily volume</Label>
              <Input
                id="dailyVolume"
                name="dailyVolume"
                defaultValue={registration?.messageVolume || "500 messages"}
              />
            </div>
            <div>
              <Label htmlFor="vertical">Vertical</Label>
              <Input id="vertical" name="vertical" defaultValue={registration?.vertical || ""} />
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
