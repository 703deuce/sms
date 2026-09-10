"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingView from "@/components/appointments/kimi-ui/booking/page";
import {
  buildBookingPageModel,
  businessInfoPatch,
  consentPatch,
  type BookingSettingsApiData,
  type BookingTypeApiRow,
} from "@/features/appointments/kimi/booking/map-booking";
import type { BookingPageActions, BookingPageModel } from "@/features/appointments/kimi/booking/types";
import type { BookingProtectionMode } from "@/lib/appointments/types";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
};

function BookingLoading() {
  return (
    <div className="booking-page animate-pulse">
      <div className="h-8 w-40 rounded bg-gray-200 mb-2" />
      <div className="h-4 w-72 rounded bg-gray-100 mb-6" />
      <div className="booking-grid">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

function BookingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="booking-page flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#dcefeb] text-[#147d74]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load booking settings</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your booking page configuration.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

export function BookingConnected({ workspaceSlug, workspaceName }: Props) {
  const [settings, setSettings] = useState<BookingSettingsApiData | null>(null);
  const [types, setTypes] = useState<BookingTypeApiRow[]>([]);
  const [draft, setDraft] = useState<BookingPageModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetch("/api/appointments/settings").then((r) => {
        if (!r.ok) throw new Error("settings failed");
        return r.json();
      }),
      fetch("/api/appointments/types").then((r) => {
        if (!r.ok) throw new Error("types failed");
        return r.json();
      }),
    ])
      .then(([settingsJson, typesJson]) => {
        const apiSettings = settingsJson.data as BookingSettingsApiData;
        const apiTypes = (typesJson.data || []) as BookingTypeApiRow[];
        setSettings(apiSettings);
        setTypes(apiTypes);
        const model = buildBookingPageModel({
          settings: apiSettings,
          types: apiTypes,
          workspaceSlug,
          workspaceName,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        setDraft(model);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [workspaceName, workspaceSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const savePatch = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      const json = await res.json();
      setSettings(json.data as BookingSettingsApiData);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  const actions: BookingPageActions = useMemo(
    () => ({
      onToggleBooking: (enabled) => {
        setDraft((d) => (d ? { ...d, bookingEnabled: enabled } : d));
        void savePatch({ bookingEnabled: enabled });
      },
      onCopyLink: async () => {
        if (!draft?.bookingUrl) return;
        await navigator.clipboard.writeText(draft.bookingUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      onOpenBooking: () => {
        if (!draft?.bookingPath) return;
        window.open(draft.bookingPath, "_blank");
      },
      onBusinessFieldChange: (field, value) => {
        setDraft((d) =>
          d ? { ...d, businessInfo: { ...d.businessInfo, [field]: value } } : d,
        );
      },
      onSaveBusinessInfo: () => {
        if (!draft) return;
        void savePatch(businessInfoPatch(draft));
      },
      onConsentFieldChange: (field, value) => {
        setDraft((d) =>
          d ? { ...d, smsConsent: { ...d.smsConsent, [field]: value } } : d,
        );
      },
      onSaveConsent: () => {
        if (!draft || !settings) return;
        const patch = consentPatch(draft, settings.termsText);
        void savePatch(patch).then(() => {
          if (patch.termsVersion) {
            setDraft((d) =>
              d
                ? { ...d, smsConsent: { ...d.smsConsent, termsVersion: patch.termsVersion as string } }
                : d,
            );
          }
        });
      },
      onProtectionModeChange: (mode: BookingProtectionMode) => {
        setDraft((d) => (d ? { ...d, protectionMode: mode } : d));
        void savePatch({ bookingProtection: { mode } });
      },
      onRetry: load,
    }),
    [draft, load, savePatch],
  );

  if (loading) return <BookingLoading />;
  if (failed || !draft) return <BookingError onRetry={load} />;

  return (
    <BookingView
      model={draft}
      actions={actions}
      saving={saving}
      saved={saved}
      copied={copied}
    />
  );
}
