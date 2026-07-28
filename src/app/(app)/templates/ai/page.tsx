"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { estimateSmsSegments } from "@/lib/utils";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const businessTypes = [
  "Home services",
  "Healthcare / dental",
  "Retail / e-commerce",
  "Real estate",
  "Fitness / wellness",
  "Restaurant / hospitality",
  "Professional services",
  "Other",
];

const tones = ["Friendly", "Professional", "Urgent", "Casual", "Warm", "Direct"];
const lengths = ["Short (1 segment)", "Medium (2 segments)", "Long (3+ segments)"];
const languages = ["English", "Spanish", "French", "Bilingual EN/ES"];

export default function AiTemplatePage() {
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [goal, setGoal] = useState("Drive appointment bookings");
  const [tone, setTone] = useState(tones[0]);
  const [offer, setOffer] = useState("15% off first service");
  const [audience, setAudience] = useState("Existing customers who haven't booked in 6+ months");
  const [cta, setCta] = useState("Reply YES to schedule");
  const [length, setLength] = useState(lengths[1]);
  const [language, setLanguage] = useState(languages[0]);
  const [generated, setGenerated] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      const preview =
        language === "Spanish"
          ? `Hola {{first_name}}, ${offer.toLowerCase()} en ${businessType.toLowerCase()}. ${cta}. Msg&data rates may apply. STOP para cancelar.`
          : `Hi {{first_name}}, ${offer} for ${businessType.toLowerCase()} customers like you. ${cta}. Msg&data rates may apply. STOP to opt out.`;
      setGenerated(preview);
      setGenerating(false);
    }, 800);
  }

  const segments = generated ? estimateSmsSegments(generated) : null;

  return (
    <div>
      <PageHeader
        title="AI template generator"
        description="Describe your message goal and let AI draft a compliant SMS template you can edit and save."
        actions={
          <Link href="/templates">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to templates
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle>Describe your message</CardTitle>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="business-type">Business type</Label>
              <Select
                id="business-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              >
                {businessTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Input
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What should this message accomplish?"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tone">Tone</Label>
                <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {tones.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="offer">Offer or value prop</Label>
              <Input
                id="offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="e.g. Free estimate, 20% off, priority scheduling"
              />
            </div>
            <div>
              <Label htmlFor="audience">Target audience</Label>
              <Textarea
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cta">Call to action</Label>
                <Input
                  id="cta"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="length">Message length</Label>
                <Select id="length" value={length} onChange={(e) => setLength(e.target.value)}>
                  {lengths.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate preview
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Generated preview</CardTitle>
          {!generated ? (
            <div className="mt-8 flex flex-col items-center py-8 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Fill in the form and click Generate preview to see your AI-drafted message.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-3 text-sm leading-relaxed">
                {generated
                  .replace("{{first_name}}", "Maya")
                  .replace("{{business_name}}", "Harbor Home")}
              </div>
              {segments ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {segments.characters} characters · {segments.segments} segment
                  {segments.segments !== 1 ? "s" : ""} · {tone} tone
                </p>
              ) : null}
              <Textarea
                className="mt-4"
                value={generated}
                onChange={(e) => setGenerated(e.target.value)}
                rows={4}
              />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  Regenerate
                </Button>
                <Link href="/templates/new">
                  <Button size="sm">Save as template</Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
