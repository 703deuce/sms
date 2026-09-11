"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, X } from "lucide-react";
import { useMembershipEditor } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { accessSummary } from "@/lib/appointments/memberships/membership-form";
import { MembershipLocalNav } from "./membership-local-nav";
import { MembershipObjectHeader } from "./membership-object-header";
import { MembershipSectionWorkspace } from "./membership-section-workspace";
import { MembershipSummaryStrip } from "./membership-summary-strip";
import { MEMBERSHIP_SECTIONS, type MembershipSectionId } from "./membership-section-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";
const VALID_SECTIONS = new Set<string>(MEMBERSHIP_SECTIONS.map((s) => s.id));

type Props = { membershipId: string };

export function MembershipEditorConnected({ membershipId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = useMembershipEditor(membershipId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  const sectionParam = searchParams.get("section");
  const section: MembershipSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as MembershipSectionId)
      : "overview";

  const setSection = useCallback(
    (next: MembershipSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/memberships/${membershipId}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [membershipId, router, searchParams],
  );

  const access = accessSummary(editor.form);
  const attention = useMemo(() => {
    const flags = new Set<MembershipSectionId>();
    if (!editor.form.name.trim()) flags.add("overview");
    if (access.total === 0) flags.add("access");
    if (editor.form.priceCents < 0) flags.add("pricing");
    return flags;
  }, [access.total, editor.form.name, editor.form.priceCents]);

  const renewalsThisMonth = useMemo(
    () => editor.activity.filter((row) => row.event.toLowerCase().includes("renew")).length,
    [editor.activity],
  );

  const createdParam = searchParams.get("created");
  useEffect(() => {
    if (!createdParam) return;
    setCreatedNotice("Membership created");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const query = params.toString();
    router.replace(`/appointments/memberships/${membershipId}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [createdParam, membershipId, router, searchParams]);

  if (editor.loading) {
    return <div className={`${SHELL_CLASS} p-8 text-[var(--text-secondary)]`}>Loading membership…</div>;
  }

  if (editor.failed) {
    return (
      <div className={`${SHELL_CLASS} p-8`}>
        <p className="text-[var(--state-error)]">Membership not found.</p>
        <Link href="/appointments/memberships" className="ws-text-btn mt-2">Back to memberships</Link>
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

        <MembershipObjectHeader
          form={editor.form}
          saveStatus={editor.saveStatus}
          saving={editor.saving}
          error={editor.error}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          onSave={() => void editor.save()}
          onDuplicate={() => void editor.duplicateMembership()}
          onDeactivate={() => void editor.deactivateMembership()}
          onDelete={() => void editor.deleteMembership()}
        />

        <MembershipSummaryStrip
          form={editor.form}
          memberStats={editor.memberStats}
          renewalsThisMonth={renewalsThisMonth}
        />

        <MembershipLocalNav active={section} onChange={setSection} attention={attention} />

        <div className="px-4 py-4 lg:px-6">
          {attention.has(section) ? (
            <p className="ws-inline-error mb-3" role="status">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              This section still needs configuration before the membership is ready to sell.
            </p>
          ) : null}
          <MembershipSectionWorkspace
            section={section}
            editor={editor}
            onNavigate={setSection}
            renewalsThisMonth={renewalsThisMonth}
          />
        </div>
      </div>
    </div>
  );
}
