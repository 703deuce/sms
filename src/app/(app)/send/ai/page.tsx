"use client";

import { AiOfflineBanner } from "@/components/ai/ai-offline-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export default function AiCampaignComposerPage() {
  const [goal, setGoal] = useState("book more appointments");
  const [audience, setAudience] = useState("past customers who haven't booked in 90 days");
  const [tone, setTone] = useState("friendly");
  const [offer, setOffer] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://example.com/book");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function compose() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/campaign-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          audience,
          tone,
          offer,
          includeLink: Boolean(destinationUrl),
          destinationUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.data);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Campaign Composer"
        description="Generate campaign copy, variations, compliance footer, and send-time suggestions."
      />
      <AiOfflineBanner />
      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <Label>Goal</Label>
          <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div>
          <Label>Audience</Label>
          <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
        </div>
        <div>
          <Label>Tone</Label>
          <Input value={tone} onChange={(e) => setTone(e.target.value)} />
        </div>
        <div>
          <Label>Offer (optional)</Label>
          <Input value={offer} onChange={(e) => setOffer(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Tracked link destination</Label>
          <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={compose} disabled={loading}>
            <Sparkles className="h-4 w-4" />
            {loading ? "Composing…" : "Generate campaign"}
          </Button>
        </div>
      </Card>
      {result && (
        <Card className="space-y-4 p-5">
          {"error" in result && result.error ? (
            <p className="text-sm text-red-600">{String(result.error)}</p>
          ) : (
            <>
              {typeof result.subject === "string" || typeof result.name === "string" ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Campaign
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {String(result.subject || result.name || "Generated campaign")}
                  </p>
                </div>
              ) : null}
              {typeof result.body === "string" || typeof result.message === "string" ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Message
                  </p>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                    {String(result.body || result.message)}
                  </p>
                </div>
              ) : null}
              {typeof result.complianceFooter === "string" || typeof result.footer === "string" ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Compliance footer
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {String(result.complianceFooter || result.footer)}
                  </p>
                </div>
              ) : null}
              {Array.isArray(result.variations) || Array.isArray(result.abVersions) ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Variations
                  </p>
                  <ul className="mt-2 space-y-2">
                    {((result.variations || result.abVersions) as unknown[]).map((v, i) => (
                      <li key={i} className="rounded-lg border border-border px-3 py-2 text-sm">
                        {typeof v === "string" ? v : JSON.stringify(v)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {typeof result.sendTimeSuggestion === "string" || typeof result.sendWindow === "string" ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Send-time suggestion
                  </p>
                  <p className="mt-1 text-sm">{String(result.sendTimeSuggestion || result.sendWindow)}</p>
                </div>
              ) : null}
              {!result.body && !result.message && !result.variations && !result.abVersions ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(result).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {key}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
