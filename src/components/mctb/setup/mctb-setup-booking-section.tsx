"use client";

import { useCallback, useEffect, useState } from "react";
import type { MctbBookingLinkDto } from "@/lib/mctb/booking-links/service";
import { bookingLinkHostname, validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";

type FormState = {
  label: string;
  url: string;
  description: string;
  active: boolean;
  isDefault: boolean;
};

const emptyForm = (): FormState => ({
  label: "",
  url: "",
  description: "",
  active: true,
  isDefault: false,
});

export function MctbSetupBookingSection() {
  const [links, setLinks] = useState<MctbBookingLinkDto[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recoveryLinkEnabled, setRecoveryLinkEnabled] = useState(false);
  const [recoveryLinkId, setRecoveryLinkId] = useState<string | null>(null);
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [aiEntitled, setAiEntitled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<"microsoft" | "calendly">("microsoft");
  const [aiTargetId, setAiTargetId] = useState("");
  const [aiFallbackId, setAiFallbackId] = useState("");
  const [aiReadiness, setAiReadiness] = useState<string>("");
  const [aiTargets, setAiTargets] = useState<Array<{ id: string; label: string }>>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testSlots, setTestSlots] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [linksRes, setupRes, aiRes] = await Promise.all([
      fetch("/api/mctb/booking-links"),
      fetch("/api/mctb/setup", { cache: "no-store" }),
      fetch("/api/mctb/ai-booking/config"),
    ]);
    const json = await linksRes.json();
    setLinks((json.data || []) as MctbBookingLinkDto[]);
    if (setupRes.ok) {
      const setupJson = await setupRes.json();
      const defaultUrl = (setupJson.data?.runtime?.defaultLinkUrl as string | null) || null;
      const rows = (json.data || []) as MctbBookingLinkDto[];
      const match = defaultUrl ? rows.find((r) => r.url === defaultUrl) : undefined;
      setRecoveryLinkEnabled(Boolean(defaultUrl && match));
      setRecoveryLinkId(match?.id ?? rows.find((r) => r.isDefault)?.id ?? rows[0]?.id ?? null);
    }
    if (aiRes.ok) {
      const aiJson = await aiRes.json();
      const cfg = aiJson.data?.config;
      setAiEntitled(Boolean(aiJson.data?.entitled));
      setAiEnabled(Boolean(cfg?.enabled));
      setAiProvider(cfg?.provider === "calendly" ? "calendly" : "microsoft");
      setAiTargetId(cfg?.eventTypeUri || cfg?.calendarId || cfg?.serviceName || "");
      setAiFallbackId(cfg?.fallbackBookingLinkId || "");
      setAiReadiness(aiJson.data?.readiness?.ready ? "Ready" : "Needs attention");
    }
  }, []);

  const loadTargets = useCallback(async (provider: "microsoft" | "calendly") => {
    const res = await fetch(`/api/mctb/ai-booking/config?targets=1&provider=${provider}`);
    const json = await res.json();
    setAiTargets((json.data?.targets || []) as Array<{ id: string; label: string }>);
  }, []);

  useEffect(() => {
    void loadTargets(aiProvider).catch(() => setAiTargets([]));
  }, [aiProvider, loadTargets]);

  const saveAiConfig = async (patch: Record<string, unknown>) => {
    setAiSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/ai-booking/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save AI Booking");
      setAiReadiness(json.data?.readiness?.ready ? "Ready" : "Needs attention");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAiSaving(false);
    }
  };

  const runTestAvailability = async () => {
    setTestOpen(true);
    setTestSlots([]);
    const res = await fetch("/api/mctb/ai-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test_availability",
        timezone: "America/New_York",
        windowStartUtc: new Date(Date.now() + 24 * 3600_000).toISOString(),
        windowEndUtc: new Date(Date.now() + 48 * 3600_000).toISOString(),
      }),
    });
    const json = await res.json();
    const slots = (json.data?.slots || []) as Array<{ startUtc: string }>;
    setTestSlots(
      slots.slice(0, 6).map((s) =>
        new Date(s.startUtc).toLocaleString("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      ),
    );
  };

  useEffect(() => {
    void load().catch(() => setLinks([]));
  }, [load]);

  const saveRecoveryLinkPrefs = async (enabled: boolean, linkId: string | null) => {
    const link = linkId ? links.find((l) => l.id === linkId) : undefined;
    setRecoverySaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultLinkUrl: enabled && link ? link.url : null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not save recovery booking link");
      }
      setRecoveryLinkEnabled(enabled);
      setRecoveryLinkId(linkId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRecoverySaving(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: MctbBookingLinkDto) => {
    setEditingId(row.id);
    setForm({
      label: row.label,
      url: row.url,
      description: row.description || "",
      active: row.active,
      isDefault: row.isDefault,
    });
    setError(null);
    setDrawerOpen(true);
  };

  const save = async () => {
    const v = validateBookingLinkUrl(form.url);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (!form.label.trim()) {
      setError("Label is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: form.label,
        url: form.url,
        description: form.description || null,
        active: form.active,
        isDefault: form.isDefault,
      };
      const res = editingId
        ? await fetch(`/api/mctb/booking-links/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/mctb/booking-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Save failed");
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this booking link?")) return;
    await fetch(`/api/mctb/booking-links/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <section className="mctb-recovery-module" aria-labelledby="mctb-setup-booking">
      <div className="mctb-recovery-module__head">
        <h3 id="mctb-setup-booking" className="mctb-recovery-module__title">Booking</h3>
        <p className="mctb-recovery-module__desc">
          External scheduler links for conversations — not Transovo appointments.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7a8494]">Booking links</p>
          <ul className="mt-2 space-y-2">
            {links.length === 0 ? (
              <li className="text-[13px] text-[#7a8494]">No links configured yet.</li>
            ) : (
              links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#eaedf0] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#0a0d12]">
                      {link.label}
                      {link.isDefault ? (
                        <span className="ml-2 text-[11px] font-medium text-[var(--mctb-brand-icon,#4a5fc9)]">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[12px] text-[#7a8494]">{bookingLinkHostname(link.url)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-[#7a8494]">{link.active ? "Active" : "Off"}</span>
                    <button type="button" className="text-[12px] font-semibold text-[var(--mctb-brand-strong)]" onClick={() => openEdit(link)}>
                      Edit
                    </button>
                    <button type="button" className="text-[12px] text-[#b42318]" onClick={() => void remove(link.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            className="mt-3 text-[13px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)]"
            onClick={openCreate}
          >
            Add booking link
          </button>
        </div>

        <div className="rounded-lg border border-[#eaedf0] bg-white px-3 py-3">
          <p className="text-[13px] font-semibold text-[#0a0d12]">Include booking link in initial recovery</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#4a5563]">
            When enabled, {"{{link}}"} in your recovery template resolves to the selected external scheduler URL.
          </p>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-[#0a0d12]">
            <input
              type="checkbox"
              checked={recoveryLinkEnabled}
              disabled={recoverySaving || links.length === 0}
              onChange={(e) => {
                const on = e.target.checked;
                const id = recoveryLinkId ?? links.find((l) => l.isDefault)?.id ?? links[0]?.id ?? null;
                void saveRecoveryLinkPrefs(on, id);
              }}
            />
            {recoveryLinkEnabled ? "On" : "Off"}
          </label>
          {recoveryLinkEnabled && links.length > 0 ? (
            <label className="mt-3 block text-[12px] font-medium text-[#4a5563]">
              Default booking link for recovery
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] px-3 text-[14px]"
                value={recoveryLinkId ?? ""}
                disabled={recoverySaving}
                onChange={(e) => {
                  const id = e.target.value || null;
                  void saveRecoveryLinkPrefs(true, id);
                }}
              >
                {links.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.label} ({bookingLinkHostname(link.url)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#eaedf0] bg-[#f9fafb] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[#0a0d12]">AI Booking</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7a8494]">Premium</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#4a5563]">
            Check live provider availability and complete booking in the conversation. Never invents times.
          </p>
          {!aiEntitled ? (
            <button type="button" className="mt-2 h-9 rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold text-[#0a0d12]">
              Upgrade
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  disabled={aiSaving}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAiEnabled(on);
                    void saveAiConfig({ enabled: on, provider: aiProvider });
                  }}
                />
                Enabled
              </label>
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Provider
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] bg-white px-3 text-[14px]"
                  value={aiProvider}
                  disabled={aiSaving}
                  onChange={(e) => {
                    const p = e.target.value as "microsoft" | "calendly";
                    setAiProvider(p);
                    void saveAiConfig({ provider: p, enabled: aiEnabled });
                  }}
                >
                  <option value="microsoft">Microsoft Calendar</option>
                  <option value="calendly">Calendly</option>
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Scheduling target
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] bg-white px-3 text-[14px]"
                  value={aiTargetId}
                  disabled={aiSaving}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAiTargetId(id);
                    void saveAiConfig(
                      aiProvider === "calendly"
                        ? { eventTypeUri: id, enabled: aiEnabled, provider: aiProvider }
                        : { calendarId: id, serviceName: id, enabled: aiEnabled, provider: aiProvider },
                    );
                  }}
                >
                  <option value="">Select…</option>
                  {aiTargets.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Fallback booking link
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] bg-white px-3 text-[14px]"
                  value={aiFallbackId}
                  disabled={aiSaving}
                  onChange={(e) => {
                    setAiFallbackId(e.target.value);
                    void saveAiConfig({ fallbackBookingLinkId: e.target.value || null, enabled: aiEnabled });
                  }}
                >
                  <option value="">None</option>
                  {links.filter((l) => l.active).map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] text-[#4a5563]">Status: <strong>{aiReadiness}</strong></p>
              <button
                type="button"
                className="h-9 rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold"
                onClick={() => void runTestAvailability()}
              >
                Test availability
              </button>
            </div>
          )}
        </div>
      </div>

      {testOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 p-4" onClick={() => setTestOpen(false)}>
          <div className="max-w-md rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[15px] font-semibold">Test availability</h4>
            <p className="mt-2 text-[13px] text-[#4a5563]">Slots returned from your connected provider (tomorrow window).</p>
            <ul className="mt-3 space-y-1 text-[13px]">
              {testSlots.length ? testSlots.map((s) => <li key={s}>{s}</li>) : <li>No slots returned</li>}
            </ul>
            <button type="button" className="mt-4 text-[13px] font-semibold" onClick={() => setTestOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-black/30"
          role="presentation"
          onClick={() => !saving && setDrawerOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-[min(560px,100%)] flex-col bg-white shadow-xl"
            role="dialog"
            aria-label={editingId ? "Edit booking link" : "Add booking link"}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="border-b border-[#eaedf0] px-5 py-4">
              <h4 className="text-[15px] font-semibold text-[#0a0d12]">
                {editingId ? "Edit booking link" : "Add booking link"}
              </h4>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Label
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] px-3 text-[14px]"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Free estimate"
                />
              </label>
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Booking URL
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-[#dde2ea] px-3 text-[14px]"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://calendly.com/..."
                />
              </label>
              <label className="block text-[12px] font-medium text-[#4a5563]">
                Description (optional)
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-[#dde2ea] px-3 py-2 text-[14px]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#0a0d12]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#0a0d12]">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Set as default
              </label>
              {error ? <p className="text-[12px] text-[#b42318]">{error}</p> : null}
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#eaedf0] px-5 py-4">
              <button type="button" className="h-10 px-4 text-[13px]" onClick={() => setDrawerOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-[#1b1e23] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save booking link"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
