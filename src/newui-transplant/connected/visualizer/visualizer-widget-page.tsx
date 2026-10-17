"use client";

import { useEffect, useState } from "react";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

export function VisualizerWidgetPage() {
  const [config, setConfig] = useState<{
    published: boolean;
    hostedUrl: string;
    embedSnippet: string;
    brandingJson: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/visualizer/widget")
      .then((r) => r.json())
      .then((d) => setConfig(d.config))
      .catch(() => {});
  }, []);

  async function publish() {
    const r = await fetch("/api/visualizer/widget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: true }),
    });
    const d = await r.json();
    setConfig(d.config);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Website visualizer</h1>
        <p className="text-sm text-muted-foreground">Turn website visitors into remodeling design leads.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={OPUS_CARD + " space-y-4 p-6"}>
          <p className="text-sm">
            Status: <strong>{config?.published ? "Published" : "Draft"}</strong>
          </p>
          <Button onClick={publish} disabled={config?.published}>Publish hosted page</Button>
          {config?.hostedUrl ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Hosted URL</p>
              <code className="block break-all rounded bg-muted p-2">{config.hostedUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(config.hostedUrl)}
              >
                Copy URL
              </Button>
            </div>
          ) : null}
          {config?.embedSnippet ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Embed code</p>
              <textarea
                readOnly
                className="min-h-[100px] w-full rounded border p-2 text-xs font-mono"
                value={config.embedSnippet}
                aria-label="Embed snippet"
              />
            </div>
          ) : null}
        </section>
        <section className={OPUS_CARD + " p-6 text-sm text-muted-foreground"}>
          <p>{config?.brandingJson?.headline || "See your new bathroom before you remodel."}</p>
          <p className="mt-2">{config?.brandingJson?.subtitle}</p>
        </section>
      </div>
    </div>
  );
}
