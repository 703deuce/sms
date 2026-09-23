"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import {
  DEFAULT_MCTB_REQUEST_FORM_FIELDS,
  mctbRequestFormPublicPath,
  type MctbRequestFormField,
} from "@/lib/mctb/request-form-shared";
import { MCTB_RECOVERY_GOALS } from "@/lib/mctb/recovery-goals";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function MctbSetupLinksView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [defaultLinkUrl, setDefaultLinkUrl] = useState("");
  const [requestFormEnabled, setRequestFormEnabled] = useState(false);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  const [requestFormUrl, setRequestFormUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<MctbRequestFormField[]>(DEFAULT_MCTB_REQUEST_FORM_FIELDS);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const r = json.data.runtime;
      setPhoneNumberId(r.phoneNumberId);
      setDefaultLinkUrl(r.defaultLinkUrl || "");
      setRequestFormEnabled(Boolean(r.requestFormEnabled));
      setLeadCaptureEnabled(Boolean(r.leadCaptureEnabled));
      const loadedFields = Array.isArray(r.requestFormFieldsJson) && r.requestFormFieldsJson.length
        ? (r.requestFormFieldsJson as MctbRequestFormField[])
        : DEFAULT_MCTB_REQUEST_FORM_FIELDS;
      setFields(loadedFields);
      if (r.requestFormToken) {
        setRequestFormUrl(mctbRequestFormPublicPath(r.requestFormToken));
      } else {
        setRequestFormUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkPreview = useMemo(() => {
    if (requestFormEnabled && requestFormUrl) return requestFormUrl;
    return defaultLinkUrl.trim() || null;
  }, [defaultLinkUrl, requestFormEnabled, requestFormUrl]);

  async function save() {
    setFieldError(null);
    if (!isValidHttpUrl(defaultLinkUrl)) {
      setFieldError("Default link must be a valid http or https URL.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          defaultLinkUrl: defaultLinkUrl.trim() || null,
          requestFormEnabled,
          leadCaptureEnabled,
          requestFormFieldsJson: fields,
          activate: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicUrl() {
    if (!requestFormUrl) return;
    const absolute =
      typeof window !== "undefined" ? `${window.location.origin}${requestFormUrl}` : requestFormUrl;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }

  if (loading) {
    return (
      <div className="mctb-page voice-theme">
        <div className="mctb-page-inner">
          <div className="voice-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Links & request form"
      description="Configure the {{link}} variable in recovery texts and an optional public request form for callers."
      saving={saving}
      saved={saved}
      error={error || fieldError}
      onSave={() => void save()}
    >
      <div className="voice-card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <div>
            <span className="text-muted-foreground">Used in:</span>{" "}
            <Link href={MCTB_ROUTES.setupTextBack} className="font-semibold text-primary hover:underline">
              Text Back message template
            </Link>
          </div>
          <span className="text-muted-foreground">Insert {"{{link}}"} in your opener</span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-foreground">Default link URL</span>
          <Input
            value={defaultLinkUrl}
            onChange={(e) => setDefaultLinkUrl(e.target.value)}
            placeholder="https://example.com/contact"
            aria-invalid={!isValidHttpUrl(defaultLinkUrl)}
          />
          <span className="text-[11px] text-muted-foreground">
            Used when the request form is off. Only http/https URLs are allowed.
          </span>
        </label>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[13px] font-semibold">Request form presets</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Aligned to recovery goals — applies to the authoritative request form fields below.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MCTB_RECOVERY_GOALS.filter((g) => g.requestFormPreset.length > 0).map((g) => (
              <Button
                key={g.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFields(g.requestFormPreset);
                  if (g.id === "collect_details" || g.id === "request_callback") {
                    setRequestFormEnabled(true);
                  }
                }}
              >
                {g.title}
              </Button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-1"
            checked={requestFormEnabled}
            onChange={(e) => setRequestFormEnabled(e.target.checked)}
          />
          <span>
            <span className="font-semibold text-foreground">Enable public request form</span>
            <span className="mt-0.5 block text-muted-foreground">
              When enabled, {"{{link}}"} resolves to your hosted Transovo request form instead of the default URL.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-1"
            checked={leadCaptureEnabled}
            onChange={(e) => setLeadCaptureEnabled(e.target.checked)}
            disabled={!requestFormEnabled}
          />
          <span>
            <span className="font-semibold text-foreground">Lead capture</span>
            <span className="mt-0.5 block text-muted-foreground">
              Create or update contacts when someone submits the request form.
            </span>
          </span>
        </label>

        {requestFormEnabled ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Form fields</p>
            <ul className="space-y-2">
              {fields.map((field) => (
                <li key={field.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{field.label}</span>
                  <span className="text-muted-foreground">({field.type})</span>
                  {field.required ? (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Required
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Default fields are used for V1. Custom field editing will expand in a later release.
            </p>
          </div>
        ) : null}

        {requestFormEnabled && requestFormUrl ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Link2 className="h-4 w-4" aria-hidden />
              Public request form
            </div>
            <p className="break-all text-sm text-primary">{requestFormUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPublicUrl()}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={requestFormUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Preview form
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        {linkPreview ? (
          <div className="rounded-lg bg-muted/40 p-3 text-[13px]">
            <p className="font-semibold text-foreground">Resolved {"{{link}}"} preview</p>
            <p className="mt-1 break-all text-primary">{linkPreview}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-[13px] text-muted-foreground">
            No link configured yet — add a default URL or enable the request form.
          </div>
        )}
      </div>
    </MctbSetupSectionLayout>
  );
}
