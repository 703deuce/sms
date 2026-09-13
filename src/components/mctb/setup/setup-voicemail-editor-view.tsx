"use client";

import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbVoicemailSetupSection } from "@/components/mctb/voicemail-setup-section";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function MctbSetupVoicemailEditorView() {
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setPhoneNumberId(json.data?.runtime?.phoneNumberId ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Voicemail"
      description="Configure greeting sources and voicemail behavior for missed calls."
      showSave={false}
      headerAction={
        <Link
          href={MCTB_ROUTES.voicemail}
          className="mctb-setup-btn mctb-setup-btn--outline text-[13px]"
        >
          Open voicemail inbox
        </Link>
      }
    >
      <div className="ref-card p-5">
        <MctbVoicemailSetupSection phoneNumberId={phoneNumberId} />
      </div>
    </MctbSetupSectionLayout>
  );
}
