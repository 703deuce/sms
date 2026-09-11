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
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";
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
    return <div className={`${SHELL_CLASS} p-8 text-[var(--text-secondary)]`}>Loading package…</div>;
  }

  if (editor.failed) {
    return (
      <div className={`${SHELL_CLASS} p-8`}>
        <p className="text-[var(--state-error)]">Package not found.</p>
        <Link href="/appointments/packages" className="ws-text-btn mt-2">Back to packages</Link>
      </div>
    );
  }

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        {createdNotice ? (
          <div className="ws-toast" role="status">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {createdNotice}
            <button type="button" aria-label="Dismiss" onClick={() => setCreatedNotice(null)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
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

        <PackageSummaryStrip
          form={editor.form}
          ownerStats={{ active: editor.ownerStats.active, remaining: editor.ownerStats.remaining }}
          redeemedCount={redeemedCount}
        />

        <PackageLocalNav active={section} onChange={setSection} attention={attention} />

        <div className="px-4 py-4 lg:px-6">
          {attention.has(section) ? (
            <p className="ws-inline-error mb-3" role="status">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              This section still needs configuration before the package is ready to sell.
            </p>
          ) : null}
          <PackageSectionWorkspace section={section} editor={editor} onNavigate={setSection} />
        </div>
      </div>
    </div>
  );
}
