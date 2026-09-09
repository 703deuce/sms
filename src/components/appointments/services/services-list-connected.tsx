"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  serviceDurationSummary,
  serviceIsActive,
  serviceLocationSummary,
  servicePriceLabel,
  serviceStaffSummary,
  visibilityLabel,
} from "@/lib/appointments/services/service-display";
import "@/components/appointments/kimi-ui/overview/reference.css";

export function ServicesListConnected() {
  const [rows, setRows] = useState<ApiTypeRow[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [locationNames, setLocationNames] = useState<Map<string, string>>(new Map());
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes, categoriesRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/service-booking/categories"),
      ]);
      if (!typesRes.ok) throw new Error("types failed");
      const typesJson = await typesRes.json();
      setRows((typesJson.data || []) as ApiTypeRow[]);
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const platform = settingsJson.data?.platform || settingsJson.platform || {};
        setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
        const staffMap = new Map<string, string>();
        for (const s of platform.staff || []) {
          if (s.id && s.name) staffMap.set(s.id, s.name);
        }
        setStaffNames(staffMap);
        const locMap = new Map<string, string>();
        for (const l of platform.locations || []) {
          if (l.id && l.name) locMap.set(l.id, l.name);
        }
        setLocationNames(locMap);
      }
      if (categoriesRes.ok) {
        const categoriesJson = await categoriesRes.json();
        const catMap = new Map<string, string>();
        for (const c of categoriesJson.data || categoriesJson || []) {
          if (c.id && c.name) catMap.set(c.id, c.name);
        }
        setCategoryNames(catMap);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const services = useMemo(
    () => rows.filter((r) => typeBelongsToSegment(r, "services")),
    [rows],
  );

  const activeCount = services.filter(serviceIsActive).length;

  const bookingUrl = useCallback(
    (id: string) => {
      if (!workspaceSlug) return null;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(id)}`;
    },
    [workspaceSlug],
  );

  const copyLink = useCallback(
    async (id: string) => {
      const url = bookingUrl(id);
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // ignore
      }
    },
    [bookingUrl],
  );

  const previewLink = useCallback(
    (id: string) => {
      const url = bookingUrl(id);
      if (url) window.open(url, "_blank");
    },
    [bookingUrl],
  );

  const duplicateService = useCallback(
    async (row: ApiTypeRow) => {
      await fetch("/api/appointments/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          durationMinutes: row.durationMinutes ?? 60,
          bufferMinutes: 0,
          config: { ...(row.config || {}), bookingTypeKind: "SERVICE" },
        }),
      });
      await load();
    },
    [load],
  );

  const toggleEnabled = useCallback(
    async (row: ApiTypeRow, enabled: boolean) => {
      const config = { ...(row.config || {}), enabled, bookingTypeKind: "SERVICE" as const };
      await fetch(`/api/appointments/types/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: row.name,
          durationMinutes: row.durationMinutes,
          config,
        }),
      });
      await load();
    },
    [load],
  );

  if (loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="mt-6 h-64 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Could not load services</p>
          <button type="button" className="mt-5 appt-pilot-primary-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/types" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Booking Types
      </Link>

      <RefDecoPageHeader
        title="Services"
        description="Create and manage the services customers can book with your business."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/appointments/categories" className="appt-pilot-outline-btn">
              Manage categories
            </Link>
            <Link href="/appointments/types/services/new" className="appt-pilot-primary-btn">
              <Plus size={15} strokeWidth={2.5} aria-hidden />
              Create service
            </Link>
          </div>
        }
      />

      {services.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <h2 className="appt-pilot-text-section">Create the services your customers book</h2>
          <p className="mx-auto mt-2 max-w-lg appt-pilot-text-body text-[var(--text-secondary)]">
            Services are for one-on-one or provider-based appointments such as training, tutoring, salon services, massage, inspections, repairs, and private sessions.
          </p>
          <Link href="/appointments/types/services/new" className="appt-pilot-primary-btn mt-5">
            Create your first service
          </Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <div className="appt-pilot-data-table-meta">
            {activeCount} active · {services.length} total
          </div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Category</th>
                <th scope="col">Duration</th>
                <th scope="col">Price</th>
                <th scope="col">Staff</th>
                <th scope="col">Location</th>
                <th scope="col">Visibility</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((row) => {
                const active = serviceIsActive(row);
                const catId = (row.config as { categoryId?: string } | undefined)?.categoryId;
                const categoryName = catId ? categoryNames.get(catId) || "—" : "—";
                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/appointments/types/services/${row.id}`}
                        className="appt-pilot-muted-link font-medium !text-[var(--text-primary)] hover:!text-[var(--brand-accent)]"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td>{categoryName}</td>
                    <td>{serviceDurationSummary(row)}</td>
                    <td>{servicePriceLabel(row.config)}</td>
                    <td>{serviceStaffSummary(row.config, staffNames)}</td>
                    <td>{serviceLocationSummary(row.config, locationNames)}</td>
                    <td>{visibilityLabel(row.config)}</td>
                    <td>
                      <span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Link
                          href={`/appointments/types/services/${row.id}`}
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil size={14} aria-hidden />
                        </Link>
                        <button
                          type="button"
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Preview ${row.name}`}
                          onClick={() => previewLink(row.id)}
                        >
                          <ExternalLink size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Copy link for ${row.name}`}
                          onClick={() => void copyLink(row.id)}
                        >
                          <Copy size={14} aria-hidden />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            className="appt-pilot-outline-btn !min-h-8 !px-2"
                            aria-label={`More actions for ${row.name}`}
                            onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          >
                            <MoreHorizontal size={14} aria-hidden />
                          </button>
                          {openMenuId === row.id ? (
                            <div className="absolute right-0 z-10 mt-1 min-w-[9rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                                onClick={() => { setOpenMenuId(null); void duplicateService(row); }}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                                onClick={() => { setOpenMenuId(null); void toggleEnabled(row, !active); }}
                              >
                                {active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {copiedId === row.id ? (
                        <span className="block appt-pilot-text-helper mt-1">Link copied</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
