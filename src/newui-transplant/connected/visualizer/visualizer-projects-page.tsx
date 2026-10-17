"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { vizClientError, vizFetchJson } from "@/lib/visualizer/client-api";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OpusDataSurface } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { Button } from "@/newui-transplant/components/ui/button";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

type ProjectRow = {
  id: string;
  name: string;
  statusLabel: string;
  transformationLabel: string;
  contact: { name: string } | null;
  designCount: number;
  thumbUrl: string | null;
};

export function VisualizerProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const url = q ? `/api/visualizer/projects?q=${encodeURIComponent(q)}` : "/api/visualizer/projects";
    vizFetchJson<{ projects?: ProjectRow[] }>("projects-list", url)
      .then((d) => setProjects(d.projects || []))
      .catch((e) => {
        vizClientError("projects-list:failed", e);
        setProjects([]);
      });
  }, [q]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage homeowner designs and remodeling opportunities.</p>
        </div>
        <Button render={<Link href={VISUALIZER_ROUTES.newDesign} />}>
          <Plus className="size-4" aria-hidden />
          New project
        </Button>
      </header>

      <OpusDataSurface
        toolbar={
          <input
            type="search"
            placeholder="Search projects"
            className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search projects"
          />
        }
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={VISUALIZER_ROUTES.project(p.id)} className={cn(OPUS_CARD, "overflow-hidden")}>
              <div className="aspect-[4/3] bg-muted/30">
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-4">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.transformationLabel} · {p.statusLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.designCount} designs{p.contact ? ` · ${p.contact.name}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </OpusDataSurface>
    </div>
  );
}
