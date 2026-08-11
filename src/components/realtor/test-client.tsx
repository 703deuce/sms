"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useState } from "react";

export function RealtorTestClient() {
  const [name, setName] = useState("Test Buyer");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState<"buyer" | "seller">("buyer");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitTestLead() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/realtor/test-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, intent, source: "test_agent", triggerCall: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      const callMsg = json.outboundStarted
        ? " Amy is calling now."
        : json.outboundCallId
          ? " Outbound call queued."
          : "";
      setResult(`Test lead created.${callMsg} View: ${json.href}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <PageHeader title="Test Amy" description="The demo that sells the Realtor product." />
      <Card className="space-y-4 p-6">
        <CardTitle>Test Speed-to-Lead</CardTitle>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Phone
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Intent
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={intent}
            onChange={(e) => setIntent(e.target.value as "buyer" | "seller")}
          >
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </label>
        <Button onClick={() => void submitTestLead()} disabled={loading || !phone.trim()}>
          Submit Test Lead — Amy Calls
        </Button>
        {result ? <p className="text-sm">{result}</p> : null}
      </Card>
      <Card className="p-6">
        <CardTitle className="mb-2">Test Front Desk</CardTitle>
        <p className="text-sm text-muted-foreground">
          Call your inbound Transovo number and pretend to be a buyer, seller, or existing client. Amy
          identifies intent, collects fields, and can book a consultation.
        </p>
      </Card>
    </div>
  );
}
