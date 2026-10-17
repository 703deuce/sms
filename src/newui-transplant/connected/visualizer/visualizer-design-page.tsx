"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Share2, Sparkles, Star } from "lucide-react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { BeforeAfterSlider } from "@/components/visualizer/before-after-slider";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

type MaterialOption = { id: string; name: string; category: string; imageUrl: string };

type DesignPayload = {
  design: {
    id: string;
    projectId: string;
    projectName?: string;
    versionNumber: number;
    originalRoomAssetId: string;
    transformation: string;
    beforeUrl: string | null;
    afterUrl: string | null;
    isFavorite: boolean;
    instructions: string | null;
    selectedMaterials: Array<{ materialId?: string; category: string }>;
    materials: Array<{ id: string; name: string; category: string; finish: string | null }>;
    jobStatus: string | null;
    jobError: string | null;
  };
};

const REFINE_CATEGORIES = [
  { key: "WALL_PANEL", label: "Wall panel" },
  { key: "SHOWER_BASE", label: "Shower base" },
  { key: "DOOR", label: "Enclosure" },
  { key: "FIXTURE", label: "Fixture finish" },
] as const;

export function VisualizerDesignPage({ projectId, designId }: { projectId: string; designId: string }) {
  const [data, setData] = useState<DesignPayload | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialOption[]>([]);
  const [picks, setPicks] = useState<Record<string, string | null>>({});
  const [refineBusy, setRefineBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/visualizer/designs/${designId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Design not found");
        return r.json();
      })
      .then((payload: DesignPayload) => {
        setData(payload);
        const initial: Record<string, string | null> = {};
        for (const row of payload.design.selectedMaterials) {
          if (row.materialId) initial[row.category] = row.materialId;
        }
        setPicks(initial);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [designId]);

  useEffect(() => {
    fetch("/api/visualizer/materials")
      .then((r) => r.json())
      .then((d) => setMaterialCatalog(d.materials || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/visualizer/share/capabilities")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmailEnabled(Boolean(d?.email)))
      .catch(() => setEmailEnabled(false));
  }, []);

  const pollJob = useCallback((jobId: string, desId: string) => {
    const tick = async () => {
      const r = await fetch(`/api/visualizer/jobs/${jobId}`);
      const j = await r.json();
      const status = j.job?.status;
      if (status === "COMPLETED") {
        window.location.href = VISUALIZER_ROUTES.design(projectId, desId);
        return;
      }
      if (status === "FAILED") {
        setError(j.job?.errorMessage || "Generation failed");
        setRefineBusy(false);
        return;
      }
      setTimeout(tick, 2500);
    };
    tick();
  }, [projectId]);

  async function onShare(opts?: { sendSms?: boolean; sendEmail?: boolean }) {
    const r = await fetch("/api/visualizer/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        designId,
        sendSms: opts?.sendSms && sharePhone.trim(),
        phone: sharePhone.trim(),
        sendEmail: opts?.sendEmail && shareEmail.trim(),
        email: shareEmail.trim(),
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || d.smsError || d.emailError || "Share failed");
      return;
    }
    setShareUrl(d.url);
    if (!opts?.sendSms && !opts?.sendEmail) {
      await navigator.clipboard.writeText(d.url);
    }
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

  async function onRefineGenerate() {
    const design = data?.design;
    if (!design?.afterUrl || !design.originalRoomAssetId) return;
    const selectedMaterials = REFINE_CATEGORIES
      .map((c) => {
        const materialId = picks[c.key];
        if (!materialId) return null;
        return { materialId, category: c.key };
      })
      .filter(Boolean) as Array<{ materialId: string; category: string }>;
    if (selectedMaterials.length === 0) {
      setError("Select at least one material to refine.");
      return;
    }
    setRefineBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/visualizer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          originalRoomAssetId: design.originalRoomAssetId,
          transformation: design.transformation,
          selectedMaterials,
          instructions: design.instructions,
          parentDesignId: designId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not start revision");
      pollJob(d.generationJobId, d.designId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revision failed");
      setRefineBusy(false);
    }
  }

  const design = data?.design;

  const materialsByCategory = useMemo(() => {
    const map: Record<string, MaterialOption[]> = {};
    for (const c of REFINE_CATEGORIES) map[c.key] = [];
    for (const m of materialCatalog) {
      if (map[m.category]) map[m.category].push(m);
    }
    return map;
  }, [materialCatalog]);

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
          <p className="text-sm text-muted-foreground">
            Version {design?.versionNumber ?? "—"} · Concept visualization — not an installation guarantee.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onFavorite} disabled={!design?.afterUrl}>
            <Star className="size-4" aria-hidden />
            Mark favorite
          </Button>
          <Button variant="outline" onClick={() => setRefineOpen((v) => !v)} disabled={!design?.afterUrl}>
            <Sparkles className="size-4" aria-hidden />
            Refine materials
          </Button>
          <Button onClick={() => setShareOpen((v) => !v)} disabled={!design?.afterUrl}>
            <Share2 className="size-4" aria-hidden />
            Share
          </Button>
        </div>
      </header>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      {shareOpen && design?.afterUrl ? (
        <section className={OPUS_CARD + " space-y-3 p-4"} aria-label="Share preview">
          <p className="text-sm font-medium">Share secure preview link</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void onShare()}>Copy link</Button>
          </div>
          <label className="block text-sm font-medium" htmlFor="share-phone">Send by SMS</label>
          <input
            id="share-phone"
            className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
            placeholder="+1…"
            value={sharePhone}
            onChange={(e) => setSharePhone(e.target.value)}
          />
          <Button size="sm" variant="outline" disabled={!sharePhone.trim()} onClick={() => void onShare({ sendSms: true })}>
            Send SMS
          </Button>
          {emailEnabled ? (
            <>
              <label className="block text-sm font-medium" htmlFor="share-email">Send by email</label>
              <input
                id="share-email"
                type="email"
                className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <Button size="sm" variant="outline" disabled={!shareEmail.trim()} onClick={() => void onShare({ sendEmail: true })}>
                Send email
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Email sharing is unavailable until Brevo transactional email is configured.</p>
          )}
          {shareUrl ? <p className="text-xs text-muted-foreground break-all">{shareUrl}</p> : null}
        </section>
      ) : null}

      {refineOpen && design?.afterUrl ? (
        <section className={OPUS_CARD + " space-y-4 p-4"} aria-label="Refine design">
          <p className="text-sm text-muted-foreground">
            Change materials and generate a new version. This design stays saved as version {design.versionNumber}.
          </p>
          {REFINE_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <p className="text-sm font-medium">{cat.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {materialsByCategory[cat.key]?.length ? (
                  materialsByCategory[cat.key].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={cn(
                        "rounded-lg border p-1 text-left",
                        picks[cat.key] === m.id && "border-primary ring-1 ring-primary",
                      )}
                      onClick={() => setPicks((prev) => ({ ...prev, [cat.key]: m.id }))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.imageUrl} alt="" className="size-14 rounded object-cover" />
                      <span className="block max-w-[88px] truncate px-1 text-[10px]">{m.name}</span>
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No {cat.label.toLowerCase()} in library.</span>
                )}
              </div>
            </div>
          ))}
          <Button onClick={() => void onRefineGenerate()} disabled={refineBusy}>
            {refineBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Generate new version
          </Button>
        </section>
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
              <li key={m.id}>
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
