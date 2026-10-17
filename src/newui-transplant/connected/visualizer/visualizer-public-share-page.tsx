"use client";

import { useEffect, useState } from "react";
import { BeforeAfterSlider } from "@/components/visualizer/before-after-slider";
import { Button } from "@/newui-transplant/components/ui/button";

export function VisualizerPublicSharePage({ slug, token }: { slug: string; token: string }) {
  const [data, setData] = useState<{
    companyName: string;
    design: { beforeUrl: string | null; afterUrl: string | null; id: string; projectId: string };
    materials: Array<{ name: string; category: string }>;
    allowEstimateRequest: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/visualizer/public/share/${slug}/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Invalid link");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("This preview link is invalid or expired."));
  }, [slug, token]);

  async function onFavorite() {
    await fetch(`/api/visualizer/public/share/${slug}/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "favorite", designId: data?.design.id }),
    });
  }

  async function onEstimate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/visualizer/public/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        shareToken: token,
        fullName: fd.get("fullName"),
        phone: fd.get("phone"),
      }),
    });
    alert("Request received — the team will follow up.");
  }

  if (error) return <main className="p-8 text-center text-sm">{error}</main>;
  if (!data?.design.beforeUrl || !data.design.afterUrl) {
    return <main className="p-8 text-center text-sm">Loading preview…</main>;
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <p className="font-semibold">{data.companyName}</p>
        <h1 className="text-xl font-semibold">Your bathroom remodel preview</h1>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <BeforeAfterSlider beforeSrc={data.design.beforeUrl} afterSrc={data.design.afterUrl} />
        <ul className="text-sm text-muted-foreground">
          {data.materials.map((m) => (
            <li key={m.name}>{m.name} · {m.category}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onFavorite}>I like this design</Button>
        </div>
        {data.allowEstimateRequest ? (
          <form onSubmit={onEstimate} className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">Request my free estimate</h2>
            <input name="fullName" required className="w-full rounded border px-3 py-2 text-sm" placeholder="Full name" />
            <input name="phone" required className="w-full rounded border px-3 py-2 text-sm" placeholder="Phone" />
            <Button type="submit">Submit</Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
