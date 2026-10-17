"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutTemplate, Share2 } from "lucide-react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";

type ProjectRow = {
  id: string;
  name: string;
  statusLabel: string;
  previewUrl: string | null;
  favoriteDesignId: string | null;
};

export function VisualizerConversationContextBanner({
  contactId,
  contactPhone,
}: {
  contactId: string;
  contactPhone?: string;
}) {
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/visualizer/projects?contactId=${encodeURIComponent(contactId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = (d?.projects || []) as ProjectRow[];
        setProject(rows[0] || null);
      })
      .catch(() => setProject(null));
  }, [contactId]);

  if (!project) return null;

  async function shareViaSms() {
    if (!project?.favoriteDesignId || !contactPhone?.trim()) {
      setShareNote("Link a completed design and ensure the contact has a phone number to text.");
      return;
    }
    setShareBusy(true);
    setShareNote(null);
    try {
      const r = await fetch("/api/visualizer/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          designId: project.favoriteDesignId,
          sendSms: true,
          phone: contactPhone.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.smsError || "Share failed");
      setShareNote("Preview link sent by SMS.");
    } catch (e) {
      setShareNote(e instanceof Error ? e.message : "Could not send preview");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-violet-50/80 px-4 py-2.5"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2 text-[13px] text-violet-950">
        <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
        <div className="flex min-w-0 items-center gap-3">
          {project.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.previewUrl} alt="" className="size-10 rounded object-cover" />
          ) : null}
          <div>
            <p className="font-semibold">Remodel visualizer · {project.name}</p>
            <p className="text-[12px] text-violet-900/85">{project.statusLabel}</p>
            {shareNote ? <p className="text-[12px] text-violet-800">{shareNote}</p> : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Link
          href={VISUALIZER_ROUTES.project(project.id)}
          className="text-[12px] font-semibold text-violet-700 hover:underline"
        >
          Open project
        </Link>
        {project.favoriteDesignId ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-700 hover:underline disabled:opacity-50"
            onClick={() => void shareViaSms()}
            disabled={shareBusy || !contactPhone}
          >
            <Share2 className="size-3.5" aria-hidden />
            Text preview
          </button>
        ) : null}
      </div>
    </div>
  );
}
