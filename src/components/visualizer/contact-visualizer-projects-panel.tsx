"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

type ProjectRow = {
  id: string;
  name: string;
  statusLabel: string;
  transformationLabel: string;
  previewUrl: string | null;
  favoriteDesignId: string | null;
  designCount: number;
  updatedAt: string;
};

export function ContactVisualizerProjectsPanel({ contactId }: { contactId: string }) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/visualizer/projects?contactId=${encodeURIComponent(contactId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load visualizer projects");
        return r.json();
      })
      .then((d) => setProjects(d.projects || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <section className={OPUS_CARD + " p-4 text-sm text-muted-foreground"} aria-busy="true">
        Loading remodel visualizer projects…
      </section>
    );
  }

  if (error) {
    return (
      <section className={OPUS_CARD + " p-4 text-sm text-destructive"} role="alert">
        {error}
      </section>
    );
  }

  if (projects.length === 0) {
    return (
      <section className={OPUS_CARD + " p-4"}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LayoutTemplate className="size-4" aria-hidden />
          Remodel visualizer
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No visualizer projects linked to this contact yet.</p>
        <Link href={VISUALIZER_ROUTES.newDesign} className="mt-3 inline-block text-sm font-medium text-primary underline">
          Create a preview
        </Link>
      </section>
    );
  }

  return (
    <section className={OPUS_CARD + " p-4"}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <LayoutTemplate className="size-4" aria-hidden />
        Remodel visualizer
      </h2>
      <ul className="mt-3 space-y-3">
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex gap-3 rounded-lg border border-border p-3"
          >
            {p.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.previewUrl}
                alt=""
                className="size-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <Link href={VISUALIZER_ROUTES.project(p.id)} className="font-medium text-sm hover:underline">
                {p.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {p.statusLabel} · {p.transformationLabel} · {p.designCount} version{p.designCount === 1 ? "" : "s"}
              </p>
              {p.favoriteDesignId ? (
                <Link
                  href={VISUALIZER_ROUTES.design(p.id, p.favoriteDesignId)}
                  className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Open selected design
                </Link>
              ) : (
                <Link
                  href={VISUALIZER_ROUTES.project(p.id)}
                  className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Open project
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
