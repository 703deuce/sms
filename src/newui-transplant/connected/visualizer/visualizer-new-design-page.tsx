"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { vizClientError, vizClientLog, vizFetchJson, vizUploadForm } from "@/lib/visualizer/client-api";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import {
  SHOWER_WALL_HEIGHT_LABELS,
  TRANSFORMATION_LABELS,
  VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT,
  VISUALIZER_LAUNCH_TRANSFORMATIONS,
  type VisualizerShowerWallHeight,
  transformationSupportsShowerWallHeight,
} from "@/lib/visualizer/constants";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = ["Photo", "Scope", "Materials", "Generate"] as const;

const TRANSFORMATION_DESCRIPTIONS: Record<string, string> = {
  TUB_TO_SHOWER: "Replace the tub with a walk-in shower in the same footprint",
  SHOWER_TO_SHOWER: "Keep the shower — replace shower wall panels only (no wall tile)",
  TUB_TO_TUB: "Keep a tub layout; refresh the tub surround with your panel",
  SHOWER_TO_TUB: "Convert an existing shower into a tub installation",
  SHOWER_AND_TUB_DECK_WRAP:
    "Panel the shower walls and wrap the tub deck/apron only — not the wall above the tub",
};

const TRANSFORMATIONS = VISUALIZER_LAUNCH_TRANSFORMATIONS.map((id) => ({
  id,
  title: TRANSFORMATION_LABELS[id] || id,
  desc: TRANSFORMATION_DESCRIPTIONS[id] || "",
}));

type MaterialRow = { id: string; name: string; category: string; imageUrl: string };

export function VisualizerNewDesignPage() {
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Bathroom remodel");
  const [roomAssetId, setRoomAssetId] = useState<string | null>(null);
  const [roomPreviewUrl, setRoomPreviewUrl] = useState<string | null>(null);
  const [transformation, setTransformation] = useState("TUB_TO_SHOWER");
  const [showerWallHeight, setShowerWallHeight] = useState<VisualizerShowerWallHeight>(
    VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT,
  );
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);

  useEffect(() => {
    vizClientLog("materials:load-start");
    vizFetchJson<{ materials?: MaterialRow[] }>("materials", "/api/visualizer/materials?category=WALL_PANEL")
      .then((d) => {
        setMaterials(d.materials || []);
        vizClientLog("materials:load-ok", { count: d.materials?.length ?? 0 });
      })
      .catch((e) => {
        vizClientError("materials:load-failed", e);
      });
  }, []);

  const pollJob = useCallback(
    (id: string, proj: string, des: string) => {
      const tick = async () => {
        try {
          const j = await vizFetchJson<{ job?: { status?: string; errorMessage?: string } }>(
            "job-poll",
            `/api/visualizer/jobs/${id}`,
          );
          const status = j.job?.status;
          vizClientLog("job-poll:status", { jobId: id, status });
          if (status === "COMPLETED") {
            window.location.href = VISUALIZER_ROUTES.design(proj, des);
            return;
          }
          if (status === "FAILED") {
            setError(j.job?.errorMessage || "Generation failed");
            setBusy(false);
            return;
          }
          setTimeout(tick, 2500);
        } catch (e) {
          vizClientError("job-poll:failed", e, { jobId: id });
          setError(e instanceof Error ? e.message : "Could not check generation status");
          setBusy(false);
        }
      };
      tick();
    },
    [],
  );

  async function ensureProject() {
    if (projectId) {
      vizClientLog("project:reuse", { projectId });
      return projectId;
    }
    const d = await vizFetchJson<{ project?: { id: string }; requestId?: string }>("project-create", "/api/visualizer/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    const id = d.project?.id;
    if (!id) {
      throw new Error(
        `(project-create) Server did not return a project id${d.requestId ? ` (ref ${d.requestId})` : ""}`,
      );
    }
    setProjectId(id);
    return id;
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    vizClientLog("upload:begin", { name: file.name, size: file.size, type: file.type || "(empty)" });
    try {
      const pid = await ensureProject();
      const fd = new FormData();
      fd.set("file", file);
      fd.set("projectId", pid);
      fd.set("assetType", "ORIGINAL_ROOM");
      const d = await vizUploadForm<{ asset?: { id: string; url: string }; requestId?: string }>(
        "room-upload",
        "/api/visualizer/upload",
        fd,
        { projectId: pid },
      );
      if (!d.asset?.id || !d.asset?.url) {
        throw new Error(
          `(room-upload) Missing asset in response${d.requestId ? ` (ref ${d.requestId})` : ""}`,
        );
      }
      setRoomAssetId(d.asset.id);
      setRoomPreviewUrl(d.asset.url);
      vizClientLog("upload:success", { assetId: d.asset.id });
    } catch (e) {
      vizClientError("upload:failed", e);
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    if (!projectId || !roomAssetId) return;
    setBusy(true);
    setError(null);
    try {
      const d = await vizFetchJson<{ error?: string; generationJobId?: string; designId?: string }>(
        "generate",
        "/api/visualizer/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            originalRoomAssetId: roomAssetId,
            transformation,
            selectedMaterials: selectedMaterialId
              ? [{ materialId: selectedMaterialId, category: "WALL_PANEL" }]
              : [],
            showerWallHeight,
          }),
        },
      );
      if (!d.generationJobId || !d.designId) {
        throw new Error("(generate) Missing job or design id in response");
      }
      setJobId(d.generationJobId);
      setDesignId(d.designId);
      pollJob(d.generationJobId, projectId, d.designId);
    } catch (e) {
      vizClientError("generate:failed", e);
      setError(e instanceof Error ? e.message : "Generation failed");
      setBusy(false);
    }
  }

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(roomAssetId);
    if (step === 1) return Boolean(transformation);
    if (step === 2) return Boolean(selectedMaterialId);
    return true;
  }, [step, roomAssetId, transformation, selectedMaterialId]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New design</p>
        <h1 className="text-2xl font-semibold">Create bathroom preview</h1>
        <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
      </header>

      <ol className="flex gap-2 text-xs font-medium" aria-label="Wizard progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full px-3 py-1",
              i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {s}
          </li>
        ))}
      </ol>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      {step === 0 ? (
        <section className={cn(OPUS_CARD, "p-6")}>
          <label className="text-sm font-medium" htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            className="mt-1 mb-4 w-full rounded-lg border px-3 py-2 text-sm"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <label
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6"
          >
            <Upload className="size-8 text-primary" aria-hidden />
            <span className="text-sm font-medium">Upload your current bathroom</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, or WebP · up to 12 MB</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
          {roomPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={roomPreviewUrl} alt="Uploaded bathroom" className="mt-4 max-h-80 w-full rounded-lg object-contain" />
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {TRANSFORMATIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  OPUS_CARD,
                  "p-4 text-left transition",
                  transformation === t.id && "border-primary ring-1 ring-primary",
                )}
                onClick={() => setTransformation(t.id)}
              >
                <p className="font-medium">{t.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
          {transformationSupportsShowerWallHeight(transformation) ? (
            <fieldset className={cn(OPUS_CARD, "space-y-3 p-4")}>
              <legend className="text-sm font-medium">Shower / surround wall height</legend>
              <p className="text-xs text-muted-foreground">
                How high should the wall panels run in the wet area?
              </p>
              {(Object.keys(SHOWER_WALL_HEIGHT_LABELS) as VisualizerShowerWallHeight[]).map((value) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="shower-wall-height"
                    className="mt-1"
                    checked={showerWallHeight === value}
                    onChange={() => setShowerWallHeight(value)}
                  />
                  <span>{SHOWER_WALL_HEIGHT_LABELS[value]}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No wall panels yet.{" "}
              <Link href={VISUALIZER_ROUTES.materialNew} className="text-primary underline">
                Add a material
              </Link>{" "}
              or upload a custom reference on the next step.
            </p>
          ) : null}
          {materials.map((m) => (
            <button
              key={m.id}
              type="button"
              className={cn(
                OPUS_CARD,
                "overflow-hidden p-0 text-left",
                selectedMaterialId === m.id && "border-primary ring-1 ring-primary",
              )}
              onClick={() => setSelectedMaterialId(m.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.imageUrl} alt="" className="aspect-square w-full object-cover" />
              <div className="p-3">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.category}</p>
              </div>
            </button>
          ))}
        </section>
      ) : null}

      {step === 3 ? (
        <section className={cn(OPUS_CARD, "space-y-4 p-6")}>
          <p className="text-sm text-muted-foreground">
            Review your photo, remodel type, and material. Generation uses fixed backend prompts — no custom text required.
          </p>
          {transformationSupportsShowerWallHeight(transformation) ? (
            <p className="text-sm text-muted-foreground">
              Wall panels: <strong>{SHOWER_WALL_HEIGHT_LABELS[showerWallHeight]}</strong>
            </p>
          ) : null}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Generating preview… you can leave this page; we&apos;ll open the design when ready.
              {jobId ? ` (job ${jobId.slice(0, 8)}…)` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step < 3 ? (
            <Button disabled={!canContinue || busy} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={busy || !roomAssetId} onClick={onGenerate}>
              {busy ? "Generating…" : "Generate remodel preview"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
