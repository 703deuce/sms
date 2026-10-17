"use client";

import { useEffect, useMemo, useState } from "react";
import { BeforeAfterSlider } from "@/components/visualizer/before-after-slider";
import { Button } from "@/newui-transplant/components/ui/button";

export function VisualizerPublicHostedPage({ slug }: { slug: string }) {
  const [config, setConfig] = useState<{
    workspaceName: string;
    branding: { headline?: string; subtitle?: string; ctaLabel?: string };
    materials: Array<{ id: string; name: string; imageUrl: string }>;
    enabledTransformations: string[];
  } | null>(null);
  const [step, setStep] = useState(0);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [transformation, setTransformation] = useState("TUB_TO_SHOWER");
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visitorKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    const k = `viz_visitor_${slug}`;
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  }, [slug]);

  useEffect(() => {
    fetch(`/api/visualizer/public/${slug}/config`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not published");
        return r.json();
      })
      .then(setConfig)
      .catch(() => setError("This visualizer is not available."));
  }, [slug]);

  async function onUpload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("transformation", transformation);
    if (materialId) fd.set("materialId", materialId);
    fd.set("visitorKey", visitorKey);
    const r = await fetch(`/api/visualizer/public/${slug}/generate`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Could not generate preview");
      return;
    }
    setProjectId(d.projectId);
    setJobId(d.generationJobId);
    setStep(2);
    const poll = async () => {
      const jr = await fetch(`/api/visualizer/public/${slug}/jobs/${d.generationJobId}`);
      const jj = await jr.json();
      if (jj.job?.status === "COMPLETED" && jj.job.previewUrl) {
        setAfterUrl(jj.job.previewUrl);
        return;
      }
      if (jj.job?.status === "FAILED") {
        setError(jj.job.errorMessage || "Generation failed");
        return;
      }
      setTimeout(poll, 3000);
    };
    poll();
  }

  async function onEstimate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/visualizer/public/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        projectId,
        fullName: fd.get("fullName"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        serviceZip: fd.get("serviceZip"),
      }),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error || "Could not submit request");
      return;
    }
    setStep(3);
  }

  if (error && !config) {
    return <main className="mx-auto max-w-lg p-8 text-center text-sm">{error}</main>;
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <p className="text-sm font-semibold">{config?.workspaceName}</p>
        <h1 className="text-xl font-semibold">{config?.branding?.headline}</h1>
        <p className="text-sm text-muted-foreground">{config?.branding?.subtitle}</p>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {step === 0 ? (
          <>
            <label className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6">
              <span className="font-medium">Upload your bathroom photo</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setBeforeUrl(URL.createObjectURL(f));
                    setStep(1);
                    (window as unknown as { __vizFile?: File }).__vizFile = f;
                  }
                }}
              />
            </label>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {(config?.enabledTransformations || ["TUB_TO_SHOWER"]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-lg border p-3 text-left text-sm"
                  onClick={() => setTransformation(t)}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(config?.materials || []).map((m) => (
                <button key={m.id} type="button" onClick={() => setMaterialId(m.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.imageUrl} alt={m.name} className="aspect-square rounded-lg border object-cover" />
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                const f = (window as unknown as { __vizFile?: File }).__vizFile;
                if (f) onUpload(f);
              }}
            >
              {config?.branding?.ctaLabel || "Preview my bathroom"}
            </Button>
          </>
        ) : null}
        {step >= 2 && beforeUrl && afterUrl ? (
          <>
            <BeforeAfterSlider beforeSrc={beforeUrl} afterSrc={afterUrl} />
            <p className="text-xs text-muted-foreground">
              AI-generated design preview for visualization purposes. Final products and installation are confirmed during your estimate.
            </p>
            {step === 2 ? (
              <form onSubmit={onEstimate} className="space-y-3 rounded-xl border p-4">
                <h2 className="font-semibold">Request my free estimate</h2>
                <input name="fullName" required placeholder="Full name" className="w-full rounded border px-3 py-2 text-sm" />
                <input name="phone" required placeholder="Mobile phone" className="w-full rounded border px-3 py-2 text-sm" />
                <input name="email" placeholder="Email" className="w-full rounded border px-3 py-2 text-sm" />
                <input name="serviceZip" placeholder="ZIP code" className="w-full rounded border px-3 py-2 text-sm" />
                <Button type="submit">Submit request</Button>
              </form>
            ) : null}
          </>
        ) : step >= 2 ? (
          <p className="text-sm text-muted-foreground">Generating your preview…</p>
        ) : null}
        {step === 3 ? (
          <p className="text-center font-medium">Your estimate request was received. The team will follow up soon.</p>
        ) : null}
      </div>
    </main>
  );
}
