"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

export function VisualizerProjectDetailPage({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<{
    project: { name: string; statusLabel: string; transformationLabel: string; beforeUrl: string | null };
    designs: Array<{ id: string; versionNumber: number; previewUrl: string | null; isFavorite: boolean }>;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/visualizer/projects/${projectId}`)
      .then((r) => r.json())
      .then(setPayload)
      .catch(() => setPayload(null));
  }, [projectId]);

  const project = payload?.project;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={VISUALIZER_ROUTES.projects}>Projects</Link>
          </p>
          <h1 className="text-2xl font-semibold">{project?.name || "Project"}</h1>
          <p className="text-sm text-muted-foreground">
            {project?.transformationLabel} · {project?.statusLabel}
          </p>
        </div>
        <Button render={<Link href={VISUALIZER_ROUTES.newDesign} />}>New design</Button>
      </header>

      {project?.beforeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={project.beforeUrl} alt="Original bathroom" className="max-h-96 rounded-xl border object-contain" />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Design versions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(payload?.designs || []).map((d) => (
            <Link
              key={d.id}
              href={VISUALIZER_ROUTES.design(projectId, d.id)}
              className={OPUS_CARD + " overflow-hidden"}
            >
              <div className="aspect-[4/3] bg-muted/30">
                {d.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-3 text-sm">
                Design {d.versionNumber}
                {d.isFavorite ? " · Favorite" : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
