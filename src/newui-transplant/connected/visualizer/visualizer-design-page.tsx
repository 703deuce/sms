"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Share2, Star } from "lucide-react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { BeforeAfterSlider } from "@/components/visualizer/before-after-slider";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

type DesignPayload = {
  design: {
    id: string;
    projectId: string;
    projectName?: string;
    beforeUrl: string | null;
    afterUrl: string | null;
    isFavorite: boolean;
    instructions: string | null;
    materials: Array<{ name: string; category: string; finish: string | null }>;
    jobStatus: string | null;
    jobError: string | null;
  };
};

export function VisualizerDesignPage({ projectId, designId }: { projectId: string; designId: string }) {
  const [data, setData] = useState<DesignPayload | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/visualizer/designs/${designId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Design not found");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [designId]);

  async function onShare() {
    const r = await fetch("/api/visualizer/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, designId }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Share failed");
      return;
    }
    setShareUrl(d.url);
    await navigator.clipboard.writeText(d.url);
  }

  async function onFavorite() {
    await fetch(`/api/visualizer/designs/${designId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: true }),
    });
    setData((prev) =>
      prev ? { design: { ...prev.design, isFavorite: true } } : prev,
    );
  }

  const design = data?.design;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={VISUALIZER_ROUTES.projects}>Projects</Link>
            {" / "}
            <Link href={VISUALIZER_ROUTES.project(projectId)}>{design?.projectName || "Project"}</Link>
          </p>
          <h1 className="text-2xl font-semibold">Your remodel preview</h1>
          <p className="text-sm text-muted-foreground">Concept visualization — not an installation guarantee.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onFavorite} disabled={!design?.afterUrl}>
            <Star className="size-4" aria-hidden />
            Mark favorite
          </Button>
          <Button onClick={onShare} disabled={!design?.afterUrl}>
            <Share2 className="size-4" aria-hidden />
            Share
          </Button>
        </div>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {shareUrl ? (
        <p className="text-sm text-muted-foreground">Share link copied: {shareUrl}</p>
      ) : null}

      {design?.beforeUrl && design.afterUrl ? (
        <BeforeAfterSlider beforeSrc={design.beforeUrl} afterSrc={design.afterUrl} />
      ) : (
        <div className={OPUS_CARD + " p-8 text-center text-sm text-muted-foreground"}>
          {design?.jobStatus === "FAILED"
            ? design.jobError || "Generation failed. Try again from the project."
            : "Preview is still generating…"}
        </div>
      )}

      {design?.materials?.length ? (
        <section className={OPUS_CARD + " p-4"}>
          <h2 className="text-sm font-semibold">Selected materials</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {design.materials.map((m) => (
              <li key={m.name + m.category}>
                {m.name} · {m.category}
                {m.finish ? ` · ${m.finish}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
