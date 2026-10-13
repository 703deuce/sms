"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, X } from "lucide-react";
import { usePackageEditor } from "@/features/appointments/kimi/packages/use-package-editor";
import { PackageLocalNav } from "./package-local-nav";
import { PackageObjectHeader } from "./package-object-header";
import { PackageSectionWorkspace } from "./package-section-workspace";
import { PackageSummaryStrip } from "./package-summary-strip";
import { PACKAGE_SECTIONS, type PackageSectionId } from "./package-section-types";
import { SchedulingEditorSplit } from "@/components/appointments/scheduling-opus/scheduling-editor-split";
import { PackageLivePreview } from "@/components/appointments/scheduling-opus/package-live-preview";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { Button } from "@/newui-transplant/components/ui/button";

const VALID_SECTIONS = new Set<string>(PACKAGE_SECTIONS.map((s) => s.id));

type Props = { packageId: string };

export function PackageEditorConnected({ packageId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = usePackageEditor(packageId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  const sectionParam = searchParams.get("section");
  const section: PackageSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as PackageSectionId)
      : "overview";

  const setSection = useCallback(
    (next: PackageSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/packages/${packageId}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [packageId, router, searchParams],
  );

  const attention = useMemo(() => {
    const flags = new Set<PackageSectionId>();
    if (!editor.form.name.trim()) flags.add("overview");
    if (editor.eligibleOfferings.length === 0) flags.add("eligible");
    if (editor.form.totalCredits < 1) flags.add("pricing");
    return flags;
  }, [editor.eligibleOfferings.length, editor.form.name, editor.form.totalCredits]);

  const createdParam = searchParams.get("created");
  useEffect(() => {
    if (!createdParam) return;
    setCreatedNotice("Package created");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const query = params.toString();
    router.replace(`/appointments/packages/${packageId}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [createdParam, packageId, router, searchParams]);

  const redeemedCount = editor.activity.filter((row) => row.kind === "redeem").length;

  if (editor.loading) {
    return (
      <ArOpusPage className="p-8 text-muted-foreground">Loading package…</ArOpusPage>
    );
  }

  if (editor.failed) {
    return (
      <ArOpusPage className="p-8">
        <p className="text-destructive">Package not found.</p>
        <Link href="/appointments/packages" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
          Back to packages
        </Link>
      </ArOpusPage>
    );
  }

  return (
    <SchedulingEditorSplit
      header={
        <>
          {createdNotice ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm" role="status">
              <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="flex-1">{createdNotice}</span>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Dismiss" onClick={() => setCreatedNotice(null)}>
                <X className="size-4" />
              </Button>
            </div>
          ) : null}
          <PackageObjectHeader
            form={editor.form}
            saveStatus={editor.saveStatus}
            saving={editor.saving}
            error={editor.error}
            menuOpen={menuOpen}
            onMenuToggle={() => setMenuOpen((v) => !v)}
            onMenuClose={() => setMenuOpen(false)}
            onSave={() => void editor.save()}
            onDuplicate={() => void editor.duplicatePackage()}
            onDeactivate={() => void editor.deactivatePackage()}
            onDelete={() => void editor.deletePackage()}
          />
        </>
      }
      subHeader={
        <PackageSummaryStrip
          form={editor.form}
          ownerStats={{ active: editor.ownerStats.active, remaining: editor.ownerStats.remaining }}
          redeemedCount={redeemedCount}
        />
      }
      nav={<PackageLocalNav active={section} onChange={setSection} attention={attention} />}
      editor={
        <>
          {attention.has(section) ? (
            <p className="mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400" role="status">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              This section still needs configuration before the package is ready to sell.
            </p>
          ) : null}
          <PackageSectionWorkspace section={section} editor={editor} onNavigate={setSection} />
        </>
      }
      preview={
        <PackageLivePreview
          form={editor.form}
          includedOfferings={editor.eligibleOfferings}
          mode={editor.form.active ? "preview" : "draft"}
        />
      }
    />
  );
}
