"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Validation = {
  valid: boolean;
  issues: Array<{ code: string; message: string }>;
};

export default function SmartRoutingTestPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [simDigits, setSimDigits] = useState("1");
  const [simSteps, setSimSteps] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/smart-routing/flows/${flowId}/validate`)
      .then((r) => r.json())
      .then((j) => setValidation(j.data));
  }, [flowId]);

  async function publish() {
    setMessage("");
    const res = await fetch(`/api/smart-routing/flows/${flowId}/publish`, { method: "POST" });
    const j = await res.json();
    setMessage(res.ok ? "Flow activated." : j.error || "Publish failed");
    if (res.ok) {
      fetch(`/api/smart-routing/flows/${flowId}/validate`)
        .then((r) => r.json())
        .then((v) => setValidation(v.data));
    }
  }

  async function testCall() {
    setMessage("");
    const res = await fetch(`/api/smart-routing/flows/${flowId}/test-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testNumber }),
    });
    const j = await res.json();
    setMessage(res.ok ? "Test call initiated." : j.error || "Test call failed");
  }

  async function simulate() {
    const digits = simDigits.split("").filter(Boolean);
    const res = await fetch(`/api/smart-routing/flows/${flowId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digits }),
    });
    const j = await res.json();
    setSimSteps(j.data?.steps ?? []);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title="Test & Activate" description="Validate, simulate, and activate your call flow." />
      <SmartRoutingSubNav flowId={flowId} active="test" />

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold text-slate-900">Validation checklist</h2>
        {validation?.issues?.length ? (
          <ul className="space-y-2 text-sm text-red-700">
            {validation.issues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">
            {validation?.valid ? "Ready to test." : "Checking…"}
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Call me to test</h2>
        <Label>Your phone number</Label>
        <Input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="+15551234567" />
        <Button variant="outline" onClick={testCall}>Call Me To Test</Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Flow simulator</h2>
        <Label>Key presses (e.g. 1)</Label>
        <Input value={simDigits} onChange={(e) => setSimDigits(e.target.value)} />
        <Button variant="outline" onClick={simulate}>Run simulation</Button>
        {simSteps.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {simSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">Activate</h2>
        <p className="text-sm text-slate-600">
          Publishing creates an immutable version used for live calls.
        </p>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={publish}>
          Activate Flow
        </Button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </Card>
    </div>
  );
}
