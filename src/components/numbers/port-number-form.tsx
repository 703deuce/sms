"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

export function PortNumberForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submitPort(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    const form = new FormData(e.currentTarget);

    const notes = String(form.get("notes") || "").trim();
    const authorizedName = String(form.get("authorizedName") || "").trim();
    const serviceAddress = String(form.get("serviceAddress") || "").trim();
    const addressParts = [serviceAddress];
    if (authorizedName) addressParts.push(`Authorized: ${authorizedName}`);
    if (notes) addressParts.push(`Notes: ${notes}`);

    try {
      const res = await fetch("/api/numbers/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: String(form.get("phoneNumber") || "").trim(),
          currentCarrier: String(form.get("currentCarrier") || "").trim(),
          accountNumber: String(form.get("accountNumber") || "").trim(),
          accountPin: String(form.get("accountPin") || "").trim(),
          billingPhone: String(form.get("billingPhone") || "").trim(),
          businessName: String(form.get("businessName") || "").trim(),
          address: addressParts.filter(Boolean).join("\n"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit port request");
      setSuccess(true);
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Port a number"
        description="Submit a port request to move an existing business number to Transovo SMS."
        actions={
          <Link href="/numbers">
            <Button variant="outline">Back to numbers</Button>
          </Link>
        }
      />

      <Tabs items={numberTabs} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Port request</CardTitle>
          {success ? (
            <p className="mt-4 text-sm text-emerald-600">
              Port request submitted. Our team will review and follow up within 1–2 business days.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
          <form className="mt-4 space-y-4" onSubmit={submitPort}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phoneNumber">Phone number to port</Label>
                <Input id="phoneNumber" name="phoneNumber" placeholder="+1 (555) 555-0100" required />
              </div>
              <div>
                <Label htmlFor="numberType">Number type</Label>
                <Select id="numberType" name="numberType" defaultValue="local">
                  <option value="local">Local</option>
                  <option value="tollfree">Toll-free</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="currentCarrier">Current carrier</Label>
                <Input id="currentCarrier" name="currentCarrier" placeholder="e.g. Verizon Business" />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account number</Label>
                <Input id="accountNumber" name="accountNumber" placeholder="Carrier account ID" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="accountPin">Account PIN / passcode</Label>
                <Input
                  id="accountPin"
                  name="accountPin"
                  type="password"
                  placeholder="If required by carrier"
                />
              </div>
              <div>
                <Label htmlFor="billingPhone">Billing telephone number</Label>
                <Input id="billingPhone" name="billingPhone" placeholder="On file with current carrier" />
              </div>
            </div>

            <div>
              <Label htmlFor="businessName">Business name on account</Label>
              <Input id="businessName" name="businessName" placeholder="Legal business name" />
            </div>

            <div>
              <Label htmlFor="serviceAddress">Service address</Label>
              <Textarea
                id="serviceAddress"
                name="serviceAddress"
                placeholder="Street, city, state, ZIP — must match carrier records"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="authorizedName">Authorized signatory</Label>
              <Input id="authorizedName" name="authorizedName" placeholder="Full name" />
            </div>

            <div>
              <Label htmlFor="notes">Additional notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Multiple numbers, partial ports, or special routing instructions"
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit port request"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>What to expect</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Typical port time: 5–10 business days</li>
              <li>Keep service active with your current carrier until port completes</li>
              <li>Letter of Authorization (LOA) may be required for verification</li>
              <li>SMS capability is enabled after A2P registration is approved</li>
            </ul>
          </Card>
          <Card>
            <CardTitle>Required documents</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Signed LOA (generated after submission)</li>
              <li>Recent carrier bill or CSR</li>
              <li>Proof of business ownership for toll-free ports</li>
            </ul>
            <Link
              href="/compliance/business"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Update business profile
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
