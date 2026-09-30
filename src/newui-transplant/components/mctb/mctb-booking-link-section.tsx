"use client";

import { useCallback, useEffect, useState } from "react";
import type { MctbBookingLinkDto } from "@/lib/mctb/booking-links/service";
import { bookingLinkHostname, validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";
import { FeatureEmphasisStrip, Pill, SettingRow } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD, OPUS_CONFIG_INSET } from "@/newui-transplant/components/app/opus-surfaces";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/newui-transplant/components/ui/input";
import { Switch } from "@/newui-transplant/components/ui/switch";
import { SaveBar } from "@/newui-transplant/components/app/save-bar";
import { saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";

/** Launch-safe booking URL editor — single authority for Text Back + AI Recovery reference. */
export function MctbBookingLinkSection() {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [sendEnabled, setSendEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("Book an appointment");
  const [linkId, setLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [linksRes, setupRes] = await Promise.all([
        fetch("/api/mctb/booking-links"),
        fetch("/api/mctb/setup", { cache: "no-store" }),
      ]);
      const linksJson = await linksRes.json();
      const setupJson = await setupRes.json();
      if (!linksRes.ok) {
        throw new Error((linksJson as { error?: string }).error || "Could not load booking links");
      }
      if (!setupRes.ok) {
        throw new Error((setupJson as { error?: string }).error || "Could not load setup");
      }
      const setup = setupJson.data ?? setupJson;
      const r = setup.runtime as Record<string, unknown>;
      setPhoneNumberId((r.phoneNumberId as string) ?? null);
      const defaultUrl = String(r.defaultLinkUrl || "").trim();
      const rows = (linksJson.data || []) as MctbBookingLinkDto[];
      const primary =
        rows.find((l) => l.isDefault && l.active !== false) ??
        rows.find((l) => l.url === defaultUrl) ??
        rows[0];
      const activeUrl = primary?.url || defaultUrl;
      setSendEnabled(Boolean(activeUrl));
      setUrl(activeUrl);
      setLabel(primary?.label || "Book an appointment");
      setLinkId(primary?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load booking link");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = async () => {
    setError(null);
    if (sendEnabled) {
      const v = validateBookingLinkUrl(url);
      if (!v.ok) {
        setError(v.error || "Enter a valid https:// booking URL");
        throw new Error(v.error || "Invalid URL");
      }
      const body = {
        label: label.trim() || "Book an appointment",
        url: url.trim(),
        active: true,
        isDefault: true,
      };
      const res = linkId
        ? await fetch(`/api/mctb/booking-links/${linkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/mctb/booking-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save booking link");
      if (json.data?.id) setLinkId(json.data.id as string);
      if (phoneNumberId) {
        await saveMctbSetup({
          phoneNumberId,
          defaultLinkUrl: url.trim(),
          activate: false,
        });
      }
    } else if (phoneNumberId) {
      await saveMctbSetup({
        phoneNumberId,
        defaultLinkUrl: null,
        activate: false,
      });
    }
    await reload();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading booking link…</p>;
  }

  const preview =
    sendEnabled && url.trim()
      ? `${label.trim() || "Book an appointment"} — ${bookingLinkHostname(url.trim())}`
      : "Booking link is off";

  return (
    <div className="flex flex-col gap-4">
      <FeatureEmphasisStrip
        icon={Link2}
        title={sendEnabled ? "Booking link in recovery texts" : "Booking link is off"}
        badge={
          <Pill tone={sendEnabled ? "success" : "neutral"} dot={false} className="ring-0">
            {sendEnabled ? "Link on" : "Link off"}
          </Pill>
        }
        description={
          sendEnabled && url.trim()
            ? `Inserts as {booking_link} — ${bookingLinkHostname(url.trim())}`
            : "Turn on to append your scheduling URL when callers text back."
        }
      />
      <SettingRow
        title="Send a booking link"
        description="Transovo can text callers your existing online booking page."
        control={
          <Switch checked={sendEnabled} onCheckedChange={setSendEnabled} aria-label="Send a booking link" />
        }
      />
      {sendEnabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="mctb-booking-url">Booking URL</label>
              <Input
                id="mctb-booking-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="mctb-booking-label">Link label</label>
              <Input
                id="mctb-booking-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Book an appointment"
              />
            </div>
          </div>
          <div className={cn(OPUS_CARD, 'border-dashed border-primary/15 bg-primary/5 px-4 py-3')}>
            <p className="text-xs font-medium text-muted-foreground">Preview in message</p>
            <p className="mt-1 text-sm">{preview}</p>
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end border-t pt-4">
        <SaveBar onSave={onSave} />
      </div>
    </div>
  );
}
