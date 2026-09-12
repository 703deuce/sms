"use client";

import { DataTablePaginationFooter } from "@/components/ui/data-table-pagination-footer";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-exclusions.css";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  ADD_EXCLUSION_REASON_PRESETS,
  callerDisplayLabel,
  canEditExclusion,
  canRemoveExclusion,
  EXCLUSIONS_DEFAULT_PAGE_SIZE,
  exclusionSummary,
  filterExclusions,
  findActiveExclusionByPhone,
  formatExclusionAddedAt,
  formatExclusionReasonLabel,
  formatExclusionSourceLabel,
  paginateExclusions,
  sortExclusions,
  type ExclusionOriginFilter,
  type ExclusionReasonFilter,
  type ExclusionRowDto,
  type ExclusionSort,
  type ExclusionSourceFilter,
} from "@/lib/mctb/setup-exclusions-model";
import type { GlobalTablePageSize } from "@/lib/ui/global-data-table";
import {
  Ban,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Shield,
  Voicemail,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function sourceIcon(source: string | null, reason: string | null) {
  const label = formatExclusionSourceLabel(source, reason);
  if (label === "Voicemail") return <Voicemail size={14} aria-hidden />;
  if (label === "Conversations") return <MessageSquare size={14} aria-hidden />;
  if (label === "Personal") return <Shield size={14} aria-hidden />;
  return <Ban size={14} aria-hidden />;
}

type ModalMode = "add" | "edit";

export function MctbSetupExclusionsView() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExclusionRowDto[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ExclusionSourceFilter>("all");
  const [originFilter, setOriginFilter] = useState<ExclusionOriginFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<ExclusionReasonFilter>("all");
  const [sort, setSort] = useState<ExclusionSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<GlobalTablePageSize>(EXCLUSIONS_DEFAULT_PAGE_SIZE);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editRow, setEditRow] = useState<ExclusionRowDto | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [reasonPreset, setReasonPreset] = useState(ADD_EXCLUSION_REASON_PRESETS[0].value);
  const [customReason, setCustomReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<ExclusionRowDto | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 280);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter, originFilter, reasonFilter, sort, pageSize]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const loadExclusions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/mctb/exclusions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to load exclusions");
      const data = Array.isArray(json.data) ? json.data : [];
      setRows(
        data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          phone: r.phone != null ? String(r.phone) : null,
          reason: r.reason != null ? String(r.reason) : null,
          source: r.source != null ? String(r.source) : null,
          createdAt:
            r.createdAt != null
              ? typeof r.createdAt === "string"
                ? r.createdAt
                : new Date(r.createdAt as string).toISOString()
              : new Date(0).toISOString(),
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load exclusions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExclusions();
  }, [loadExclusions]);

  const filtered = useMemo(
    () =>
      sortExclusions(
        filterExclusions(rows, {
          search: debouncedSearch,
          source: sourceFilter,
          origin: originFilter,
          reason: reasonFilter,
        }),
        sort,
      ),
    [rows, debouncedSearch, sourceFilter, originFilter, reasonFilter, sort],
  );

  const { pageRows, pageSafe } = useMemo(
    () => paginateExclusions(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const summary = useMemo(() => exclusionSummary(rows), [rows]);

  const filtersActive =
    debouncedSearch.trim() ||
    sourceFilter !== "all" ||
    originFilter !== "all" ||
    reasonFilter !== "all";

  function openAddModal() {
    setModalMode("add");
    setEditRow(null);
    setPhoneInput("");
    setReasonPreset(ADD_EXCLUSION_REASON_PRESETS[0].value);
    setCustomReason("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(row: ExclusionRowDto) {
    setModalMode("edit");
    setEditRow(row);
    setPhoneInput(row.phone || "");
    const preset = ADD_EXCLUSION_REASON_PRESETS.find((p) => p.value === row.reason);
    if (preset) {
      setReasonPreset(preset.value);
      setCustomReason("");
    } else {
      setReasonPreset("__custom__");
      setCustomReason(row.reason || "");
    }
    setFormError(null);
    setModalOpen(true);
    setMenuOpenId(null);
  }

  function resolvedReason(): string {
    if (reasonPreset === "__custom__") return customReason.trim() || "Do not text";
    return reasonPreset;
  }

  async function submitModal() {
    setFormError(null);
    let normalized = "";
    try {
      normalized = normalizeE164(phoneInput.trim());
    } catch {
      setFormError("Enter a valid phone number.");
      return;
    }

    const existing = findActiveExclusionByPhone(rows, normalized);
    if (modalMode === "add" && existing) {
      setFormError("duplicate");
      return;
    }

    setFormBusy(true);
    try {
      const res = await fetch("/api/mctb/exclusions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phoneInput.trim(), reason: resolvedReason() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn’t add exclusion.");
      setModalOpen(false);
      setToast(modalMode === "edit" ? "Exclusion updated." : "Exclusion added.");
      await loadExclusions();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn’t add exclusion.");
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/mctb/exclusions?id=${removeTarget.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn’t remove exclusion.");
      setRemoveTarget(null);
      setToast("Exclusion removed.");
      await loadExclusions();
    } catch {
      setToast("Couldn’t remove exclusion.");
    } finally {
      setRemoveBusy(false);
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(formatMctbPhoneLabel(phone));
      setToast("Phone number copied.");
    } catch {
      setToast("Could not copy number.");
    }
  }

  const addButton = (
    <button type="button" className="mctb-setup-btn mctb-setup-btn--primary" onClick={openAddModal}>
      Add exclusion
    </button>
  );

  const duplicateRow =
    modalMode === "add" && formError === "duplicate"
      ? findActiveExclusionByPhone(
          rows,
          (() => {
            try {
              return normalizeE164(phoneInput.trim());
            } catch {
              return "";
            }
          })(),
        )
      : undefined;

  return (
    <MctbSetupShell
      title="Exclusions"
      description="Prevent selected callers from receiving automatic missed-call recovery texts."
      headerIcon={<Ban size={18} strokeWidth={2} aria-hidden />}
      headerAction={addButton}
    >
      <div className="mctb-excl-page">
        {loadError && !loading ? (
          <div className="mctb-excl-empty" role="alert">
            <p>Unable to load exclusions.</p>
            <div className="mctb-excl-empty__actions">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                onClick={() => void loadExclusions()}
              >
                <RefreshCw size={14} className="inline mr-1" aria-hidden />
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mctb-excl-status-strip" aria-label="Exclusion summary">
              <div className="mctb-excl-status-strip__cell">
                <div className="mctb-excl-status-strip__label">Total exclusions</div>
                <div className="mctb-excl-status-strip__value">{summary.total}</div>
              </div>
              <div className="mctb-excl-status-strip__cell">
                <div className="mctb-excl-status-strip__label">Added here</div>
                <div className="mctb-excl-status-strip__value">{summary.mctb}</div>
              </div>
              <div className="mctb-excl-status-strip__cell">
                <div className="mctb-excl-status-strip__label">Personal blocks</div>
                <div className="mctb-excl-status-strip__value">{summary.personal}</div>
              </div>
              <div className="mctb-excl-status-strip__cell">
                <div className="mctb-excl-status-strip__label">Recently added</div>
                <div className="mctb-excl-status-strip__value">
                  {summary.recentThisMonth} this month
                </div>
              </div>
            </div>

            <div className="mctb-excl-toolbar">
              <div className="mctb-excl-toolbar__left">
                <input
                  type="search"
                  className="mctb-excl-search"
                  placeholder="Search phone or caller"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search exclusions"
                />
                <select
                  className="mctb-excl-select"
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value as ExclusionReasonFilter)}
                  aria-label="Filter by reason"
                >
                  <option value="all">Reason</option>
                  <option value="manual">Manual exclusion</option>
                  <option value="caller_requested">Caller requested</option>
                  <option value="voicemail">Blocked from voicemail</option>
                  <option value="business">Business request</option>
                  <option value="other">Other</option>
                </select>
                <select
                  className="mctb-excl-select"
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value as ExclusionOriginFilter)}
                  aria-label="Filter by source"
                >
                  <option value="all">Source</option>
                  <option value="exclusions">Exclusions</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="missed_calls">Missed Calls</option>
                  <option value="conversations">Conversations</option>
                  <option value="personal">Personal</option>
                </select>
                <select
                  className="mctb-excl-select"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as ExclusionSourceFilter)}
                  aria-label="Filter by record type"
                >
                  <option value="all">All types</option>
                  <option value="mctb_exclusion">MCTB exclusions</option>
                  <option value="personal_blocked">Personal blocks</option>
                </select>
                <select
                  className="mctb-excl-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ExclusionSort)}
                  aria-label="Sort exclusions"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="phone_asc">Phone A–Z</option>
                </select>
              </div>
            </div>

            <div className="mctb-excl-table-wrap">
              {loading ? (
                <table className="mctb-excl-table">
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Phone</th>
                      <th>Reason</th>
                      <th>Source</th>
                      <th className="mctb-excl-col-added-head">Added</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="mctb-excl-skeleton-row">
                        <td colSpan={6}>
                          <div className="mctb-excl-skeleton-bar" style={{ width: `${60 + (i % 3) * 10}%` }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtered.length === 0 ? (
                <div className="mctb-excl-empty">
                  {rows.length === 0 ? (
                    <>
                      <p>No excluded callers.</p>
                      <p className="mt-2 text-[12px]">
                        Automatic recovery remains subject to consent, cooldown, and other eligibility
                        rules.
                      </p>
                      <div className="mctb-excl-empty__actions">{addButton}</div>
                    </>
                  ) : (
                    <>
                      <p>No exclusions match these filters.</p>
                      <div className="mctb-excl-empty__actions">
                        <button
                          type="button"
                          className="mctb-setup-btn mctb-setup-btn--outline"
                          onClick={() => {
                            setSearch("");
                            setSourceFilter("all");
                            setOriginFilter("all");
                            setReasonFilter("all");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <table className="mctb-excl-table">
                    <thead>
                      <tr>
                        <th scope="col">Caller</th>
                        <th scope="col">Phone</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Source</th>
                        <th scope="col" className="mctb-excl-col-added-head">Added</th>
                        <th scope="col" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => {
                        const phone = row.phone || "";
                        const reasonLabel = formatExclusionReasonLabel(row.reason);
                        const rawReason = (row.reason || "").trim();
                        const showSub =
                          rawReason &&
                          reasonLabel.toLowerCase() !== rawReason.toLowerCase() &&
                          !ADD_EXCLUSION_REASON_PRESETS.some((p) => p.value === rawReason);
                        return (
                          <tr key={row.id}>
                            <td>
                              <span className="mctb-excl-caller">{callerDisplayLabel(phone)}</span>
                            </td>
                            <td>
                              {phone ? (
                                <span className="mctb-excl-phone-cell">
                                  <Phone size={13} className="text-[#8b939e]" aria-hidden />
                                  {formatMctbPhoneLabel(phone)}
                                  <button
                                    type="button"
                                    className="mctb-excl-copy-btn"
                                    title="Copy number"
                                    aria-label="Copy number"
                                    onClick={() => void copyPhone(phone)}
                                  >
                                    <Copy size={13} />
                                  </button>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <div className="mctb-excl-reason-primary">{reasonLabel}</div>
                              {showSub ? (
                                <div className="mctb-excl-reason-sub">{rawReason}</div>
                              ) : null}
                            </td>
                            <td>
                              <span className="mctb-excl-source">
                                {sourceIcon(row.source, row.reason)}
                                {formatExclusionSourceLabel(row.source, row.reason)}
                              </span>
                            </td>
                            <td className="mctb-excl-col-added text-[#626872]">
                              {formatExclusionAddedAt(row.createdAt)}
                            </td>
                            <td className="mctb-excl-actions">
                              {(canEditExclusion(row) || canRemoveExclusion(row)) && (
                                <div className="mctb-excl-menu-anchor" ref={menuOpenId === row.id ? menuRef : undefined}>
                                  <button
                                    type="button"
                                    className="mctb-excl-menu-btn"
                                    aria-label="Row actions"
                                    aria-expanded={menuOpenId === row.id}
                                    onClick={() =>
                                      setMenuOpenId((id) => (id === row.id ? null : row.id))
                                    }
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>
                                  {menuOpenId === row.id ? (
                                    <div className="mctb-excl-menu" role="menu">
                                      {canEditExclusion(row) ? (
                                        <button type="button" role="menuitem" onClick={() => openEditModal(row)}>
                                          Edit reason
                                        </button>
                                      ) : null}
                                      {canRemoveExclusion(row) ? (
                                        <button
                                          type="button"
                                          role="menuitem"
                                          className="mctb-excl-menu__danger"
                                          onClick={() => {
                                            setRemoveTarget(row);
                                            setMenuOpenId(null);
                                          }}
                                        >
                                          Remove exclusion
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="mctb-excl-mobile-list" aria-label="Exclusions list">
                    {pageRows.map((row) => (
                      <div key={row.id} className="mctb-excl-mobile-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-[13px]">
                              {callerDisplayLabel(row.phone)}
                            </div>
                            <div className="text-[13px] text-[#3a3f47]">
                              {row.phone ? formatMctbPhoneLabel(row.phone) : "—"}
                            </div>
                          </div>
                          {(canEditExclusion(row) || canRemoveExclusion(row)) && (
                            <button
                              type="button"
                              className="mctb-excl-menu-btn"
                              aria-label="Row actions"
                              onClick={() =>
                                canEditExclusion(row) ? openEditModal(row) : setRemoveTarget(row)
                              }
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-[12.5px]">{formatExclusionReasonLabel(row.reason)}</p>
                        <p className="mt-1 text-[12px] text-[#626872]">
                          Source: {formatExclusionSourceLabel(row.source, row.reason)} · Added{" "}
                          {formatExclusionAddedAt(row.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <DataTablePaginationFooter
                    page={pageSafe}
                    pageSize={pageSize}
                    total={filtered.length}
                    onPageChange={setPage}
                    onPageSizeChange={(next) => {
                      setPageSize(next);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </div>

            <section className="mctb-excl-how" aria-labelledby="mctb-excl-how-title">
              <h2 id="mctb-excl-how-title" className="mctb-excl-how__title">
                How exclusions work
              </h2>
              <div className="mctb-excl-how__grid">
                <div className="mctb-excl-how__item">
                  <strong>Recovery only</strong>
                  <p>
                    Excluded callers do not receive automatic MCTB recovery texts when{" "}
                    <em>Suppress blocked numbers</em> is enabled in recovery settings.
                  </p>
                </div>
                <div className="mctb-excl-how__item">
                  <strong>Call handling continues</strong>
                  <p>Forwarding and voicemail follow their normal configuration.</p>
                </div>
                <div className="mctb-excl-how__item">
                  <strong>Other rules still apply</strong>
                  <p>
                    Removing an exclusion does not bypass consent, cooldown, opt-out, or sender
                    eligibility.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {toast ? (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[#e2e6ea] bg-white px-4 py-2 text-[13px] font-medium shadow-lg"
            role="status"
          >
            {toast}
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="mctb-excl-modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="mctb-excl-modal"
            role="dialog"
            aria-labelledby="mctb-excl-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mctb-excl-modal__header">
              <h2 id="mctb-excl-modal-title" className="mctb-excl-modal__title">
                {modalMode === "edit" ? "Edit exclusion" : "Add exclusion"}
              </h2>
              <p className="mctb-excl-modal__sub">
                Prevent this caller from receiving automatic missed-call recovery texts.
              </p>
            </header>
            <div className="mctb-excl-modal__body">
              <div className="mctb-excl-field">
                <label htmlFor="mctb-excl-phone">Phone number</label>
                <input
                  id="mctb-excl-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phoneInput}
                  readOnly={modalMode === "edit"}
                  disabled={modalMode === "edit"}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </div>
              <div className="mctb-excl-field">
                <label htmlFor="mctb-excl-reason">Reason</label>
                <select
                  id="mctb-excl-reason"
                  value={reasonPreset}
                  onChange={(e) => setReasonPreset(e.target.value)}
                >
                  {ADD_EXCLUSION_REASON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                  <option value="__custom__">Other (custom)</option>
                </select>
              </div>
              {reasonPreset === "__custom__" ? (
                <div className="mctb-excl-field">
                  <label htmlFor="mctb-excl-custom-reason">Custom reason</label>
                  <input
                    id="mctb-excl-custom-reason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                </div>
              ) : null}
              {duplicateRow ? (
                <div className="mctb-excl-dup" role="alert">
                  This number is already excluded.
                  <div className="mt-1">
                    {formatExclusionReasonLabel(duplicateRow.reason)} · Added{" "}
                    {formatExclusionAddedAt(duplicateRow.createdAt)}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-semibold underline"
                    onClick={() => openEditModal(duplicateRow)}
                  >
                    View / Edit
                  </button>
                </div>
              ) : null}
              {formError && formError !== "duplicate" ? (
                <p className="text-[13px] text-[#b42318]" role="alert">{formError}</p>
              ) : null}
            </div>
            <footer className="mctb-excl-modal__footer">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                disabled={formBusy || !phoneInput.trim() || (duplicateRow && modalMode === "add")}
                onClick={() => void submitModal()}
              >
                {modalMode === "edit" ? "Save" : "Add exclusion"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="mctb-excl-modal-backdrop" role="presentation" onClick={() => setRemoveTarget(null)}>
          <div
            className="mctb-excl-modal"
            role="alertdialog"
            aria-labelledby="mctb-excl-remove-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mctb-excl-modal__header">
              <h2 id="mctb-excl-remove-title" className="mctb-excl-modal__title">
                Remove exclusion?
              </h2>
              <p className="mctb-excl-modal__sub">
                This caller may become eligible for automatic recovery texts again, subject to consent,
                cooldown, sender readiness, and other recovery rules.
              </p>
            </header>
            <footer className="mctb-excl-modal__footer">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                disabled={removeBusy}
                onClick={() => void confirmRemove()}
              >
                Remove exclusion
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </MctbSetupShell>
  );
}
