"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { vizClientError, vizClientLog, vizFetchJson, vizUploadForm } from "@/lib/visualizer/client-api";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import {
  TRANSFORMATION_LABELS,
  VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT,
  VISUALIZER_LAUNCH_TRANSFORMATIONS,
  MONTEREY_SURFACE_STYLE_LABELS,
  VISUALIZER_PANEL_LINE_LABELS,
  VISUALIZER_PANEL_LINE_ORDER,
  type VisualizerMontereySurfaceStyle,
  type VisualizerPanelLine,
  type VisualizerShowerWallHeight,
  transformationSupportsShowerWallHeight,
} from "@/lib/visualizer/constants";
import { ShowerWallHeightField } from "@/newui-transplant/connected/visualizer/shower-wall-height-field";
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

type MaterialRow = {
  id: string;
  name: string;
  category: string;
  manufacturer?: string | null;
  panelLine?: string | null;
  colorGroupKey?: string | null;
  surfaceStyle?: VisualizerMontereySurfaceStyle | null;
  imageUrl: string;
};

type WizardDraft = {
  step: number;
  transformation: string;
  showerWallHeight: VisualizerShowerWallHeight;
  selectedMaterialId: string | null;
  roomAssetId: string | null;
  roomPreviewUrl: string | null;
};

export function VisualizerNewDesignPage() {
  const searchParams = useSearchParams();
  const resumeProjectId = searchParams.get("projectId")?.trim() || null;
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
  const [montereyFinishByColor, setMontereyFinishByColor] = useState<
    Record<string, VisualizerMontereySurfaceStyle>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(!resumeProjectId);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDraft = useCallback(
    (pid: string) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        const draft: WizardDraft = {
          step,
          transformation,
          showerWallHeight,
          selectedMaterialId,
          roomAssetId,
          roomPreviewUrl,
        };
        void vizFetchJson("project-draft", `/api/visualizer/projects/${pid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim() || "Bathroom remodel",
            transformation,
            wizardDraftJson: draft,
            ...(roomAssetId ? { primaryRoomAssetId: roomAssetId } : {}),
          }),
        }).catch((e) => vizClientError("project-draft:failed", e));
      }, 400);
    },
    [step, transformation, showerWallHeight, selectedMaterialId, roomAssetId, roomPreviewUrl, projectName],
  );

  useEffect(() => {
    if (!resumeProjectId || draftLoaded) return;
    vizClientLog("project:resume-start", { projectId: resumeProjectId });
    vizFetchJson<{
      project?: {
        id: string;
        name: string;
        transformation?: string;
        wizardDraftJson?: WizardDraft | null;
        beforeUrl?: string | null;
      };
    }>("project-resume", `/api/visualizer/projects/${resumeProjectId}`)
      .then((d) => {
        const p = d.project;
        if (!p?.id) throw new Error("Project not found");
        setProjectId(p.id);
        setProjectName(p.name || "Bathroom remodel");
        if (p.transformation) setTransformation(p.transformation);
        const draft = p.wizardDraftJson;
        if (draft && typeof draft === "object") {
          if (typeof draft.step === "number") setStep(Math.min(3, Math.max(0, draft.step)));
          if (draft.transformation) setTransformation(draft.transformation);
          if (draft.showerWallHeight) setShowerWallHeight(draft.showerWallHeight);
          if (draft.selectedMaterialId) setSelectedMaterialId(draft.selectedMaterialId);
          if (draft.roomAssetId) setRoomAssetId(draft.roomAssetId);
          if (draft.roomPreviewUrl) setRoomPreviewUrl(draft.roomPreviewUrl);
          else if (p.beforeUrl) setRoomPreviewUrl(p.beforeUrl);
        } else if (p.beforeUrl) {
          setRoomPreviewUrl(p.beforeUrl);
        }
        vizClientLog("project:resume-ok", { projectId: p.id });
      })
      .catch((e) => {
        vizClientError("project:resume-failed", e);
        setError(e instanceof Error ? e.message : "Could not resume project");
      })
      .finally(() => setDraftLoaded(true));
  }, [resumeProjectId, draftLoaded]);

  useEffect(() => {
    if (!projectId) return;
    persistDraft(projectId);
  }, [projectId, persistDraft]);

  useEffect(() => {
    vizClientLog("materials:load-start");
    vizFetchJson<{ materials?: MaterialRow[] }>("materials", "/api/visualizer/materials?category=WALL_PANEL")
      .then((d) => {
        const rows = d.materials || [];
        setMaterials(rows);
        setSelectedMaterialId((prev) => prev ?? rows[0]?.id ?? null);
        vizClientLog("materials:load-ok", { count: rows.length });
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
    if (!roomAssetId) {
      setError("Upload a bathroom photo before generating.");
      setStep(0);
      return;
    }
    let pid = projectId;
    if (!pid) {
      try {
        pid = await ensureProject();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create project");
        return;
      }
    }
    if (!selectedMaterialId) {
      setError("Choose a wall panel material before generating.");
      setStep(2);
      return;
    }
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
            projectId: pid,
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
      pollJob(d.generationJobId, pid, d.designId);
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

  const materialsByLine = useMemo(() => {
    const buckets = new Map<string, MaterialRow[]>();
    for (const m of materials) {
      const line = m.panelLine || "OTHER";
      if (!buckets.has(line)) buckets.set(line, []);
      buckets.get(line)!.push(m);
    }
    const order: string[] = [...VISUALIZER_PANEL_LINE_ORDER];
    for (const key of buckets.keys()) {
      if (!order.includes(key)) order.push(key);
    }
    return order
      .filter((line) => buckets.has(line))
      .map((line) => ({
        line,
        label:
          line in VISUALIZER_PANEL_LINE_LABELS
            ? VISUALIZER_PANEL_LINE_LABELS[line as VisualizerPanelLine]
            : line,
        items: buckets.get(line)!,
      }));
  }, [materials]);

  function montereyFinishFor(colorKey: string): VisualizerMontereySurfaceStyle {
    return montereyFinishByColor[colorKey] ?? "tile_etch";
  }

  function selectMontereyVariant(colorKey: string, style: VisualizerMontereySurfaceStyle) {
    setMontereyFinishByColor((prev) => ({ ...prev, [colorKey]: style }));
    const variant = materials.find(
      (m) => m.colorGroupKey === colorKey && m.surfaceStyle === style,
    );
    if (variant) setSelectedMaterialId(variant.id);
  }

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
            <ShowerWallHeightField value={showerWallHeight} onChange={setShowerWallHeight} />
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-6">
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No wall panels yet.{" "}
              <Link href={VISUALIZER_ROUTES.materialNew} className="text-primary underline">
                Add a material
              </Link>{" "}
              or upload a custom reference on the next step.
            </p>
          ) : null}
          {materialsByLine.map((group) => (
            <div key={group.line} className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.line === "MONTEREY" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from(
                    new Set(group.items.map((m) => m.colorGroupKey).filter(Boolean)),
                  ).map((colorKey) => {
                    const variants = group.items.filter((m) => m.colorGroupKey === colorKey);
                    const colorName = variants[0]?.name ?? colorKey;
                    const finish = montereyFinishFor(colorKey as string);
                    const preview =
                      variants.find((m) => m.surfaceStyle === finish) ?? variants[0];
                    const selected = variants.some((m) => m.id === selectedMaterialId);
                    return (
                      <div
                        key={colorKey}
                        className={cn(
                          OPUS_CARD,
                          "overflow-hidden p-0",
                          selected && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => selectMontereyVariant(colorKey as string, finish)}
                        >
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview.imageUrl}
                              alt=""
                              className="aspect-square w-full object-cover"
                            />
                          ) : null}
                          <div className="p-3">
                            <p className="text-sm font-medium">{colorName}</p>
                            <p className="text-xs text-muted-foreground">
                              {MONTEREY_SURFACE_STYLE_LABELS[finish]}
                            </p>
                          </div>
                        </button>
                        <div
                          className="flex flex-col gap-2 border-t px-3 py-2 text-xs"
                          role="group"
                          aria-label={`Surface style for ${colorName}`}
                        >
                          {(["tile_etch", "smooth"] as const).map((style) => (
                            <label key={style} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`monterey-${colorKey}`}
                                checked={finish === style}
                                onChange={() => selectMontereyVariant(colorKey as string, style)}
                              />
                              {MONTEREY_SURFACE_STYLE_LABELS[style]}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((m) => (
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
                        <p className="text-xs text-muted-foreground">{m.manufacturer || group.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {step === 3 ? (
        <section className={cn(OPUS_CARD, "space-y-4 p-6")}>
          <p className="text-sm text-muted-foreground">
            Review your photo, remodel type, and material. Generation uses fixed backend prompts — no custom text required.
          </p>
          {transformationSupportsShowerWallHeight(transformation) ? (
            <ShowerWallHeightField value={showerWallHeight} onChange={setShowerWallHeight} />
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
            <Button
              disabled={!canContinue || busy || (!draftLoaded && Boolean(resumeProjectId))}
              onClick={() => {
                void (async () => {
                  if (step === 0 && roomAssetId && !projectId) {
                    try {
                      await ensureProject();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not save project");
                      return;
                    }
                  }
                  setStep((s) => s + 1);
                })();
              }}
            >
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
