"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SetupView from "@/components/appointments/kimi-ui/get-started/page";
import { AppointmentsSettingsSearch } from "@/components/appointments/appointments-settings-search";
import {
  buildSetupPageModel,
  deriveSetupApiStatus,
} from "@/features/appointments/kimi/setup/map-setup";
import type { SetupPageActions, SetupPageModel } from "@/features/appointments/kimi/setup/types";

function SetupLoading() {
  return (
    <div className="setup-page animate-pulse" style={{ background: "#f7f7fa", minHeight: "100%" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px 48px" }}>
        <div className="h-8 w-48 rounded bg-gray-200 mb-6" />
        <div className="grid grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="h-28 rounded-xl bg-gray-100" />
            <div className="h-96 rounded-xl bg-gray-100" />
          </div>
          <div className="space-y-4">
            <div className="h-64 rounded-xl bg-gray-100" />
            <div className="h-40 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="setup-page flex items-center justify-center min-h-[60vh]" style={{ background: "#f7f7fa" }}>
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load setup progress</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while checking your booking setup checklist.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

export function SetupConnected() {
  const router = useRouter();
  const [model, setModel] = useState<SetupPageModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetch("/api/appointments/types").then((r) => {
        if (!r.ok) throw new Error("types failed");
        return r.json();
      }),
      fetch("/api/appointments/settings").then((r) => {
        if (!r.ok) throw new Error("settings failed");
        return r.json();
      }),
    ])
      .then(([typesJson, settingsJson]) => {
        const status = deriveSetupApiStatus({
          types: typesJson.data || [],
          settings: settingsJson.data || {},
          workspaceSlug: settingsJson.workspace?.slug,
        });
        const nextModel = buildSetupPageModel({
          status,
          workspaceSlug: settingsJson.workspace?.slug || "",
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        setModel(nextModel);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions: SetupPageActions = useMemo(
    () => ({
      onStepNavigate: (href) => router.push(href),
      onMarkComplete: async () => {
        setSaving(true);
        try {
          const res = await fetch("/api/appointments/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingComplete: true }),
          });
          if (!res.ok) throw new Error("save failed");
          setModel((m) => (m ? { ...m, onboardingComplete: true } : m));
        } finally {
          setSaving(false);
        }
      },
      onCopyBookingLink: async () => {
        if (!model?.bookingLink) return;
        const url = model.bookingPath
          ? `${window.location.origin}${model.bookingPath}`
          : model.bookingLink;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      onPreviewBooking: () => {
        if (!model?.bookingPath) return;
        window.open(model.bookingPath, "_blank");
      },
      onRetry: load,
    }),
    [load, model, router],
  );

  if (loading) return <SetupLoading />;
  if (failed || !model) return <SetupError onRetry={load} />;

  return (
    <SetupView
      model={model}
      actions={actions}
      saving={saving}
      copied={copied}
      settingsSearch={<AppointmentsSettingsSearch className="max-w-md" />}
    />
  );
}
