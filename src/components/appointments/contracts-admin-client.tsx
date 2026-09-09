"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ContractTemplate = {
  id: string;
  name: string;
  version: string;
  bodyHtml: string;
  requireBeforePayment: boolean;
  eligibleTypeIds: string[];
  active: boolean;
};

type BookingType = { id: string; name: string };

export function ContractsAdminClient() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [types, setTypes] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1");
  const [bodyHtml, setBodyHtml] = useState("");
  const [requireBeforePayment, setRequireBeforePayment] = useState(false);
  const [eligibleTypeIds, setEligibleTypeIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, typesRes] = await Promise.all([
        fetch("/api/appointments/service-booking/contracts"),
        fetch("/api/appointments/types"),
      ]);
      const contractsJson = await contractsRes.json();
      const typesJson = await typesRes.json();
      if (!contractsRes.ok) throw new Error(contractsJson.error || "Could not load contracts");
      setTemplates(contractsJson.data || []);
      setTypes(typesJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setEditing(null);
    setName("");
    setVersion("1");
    setBodyHtml("<p>Service agreement terms go here.</p>");
    setRequireBeforePayment(false);
    setEligibleTypeIds([]);
    setActive(true);
    setMessage(null);
  }

  function startEdit(row: ContractTemplate) {
    setEditing(row);
    setName(row.name);
    setVersion(row.version);
    setBodyHtml(row.bodyHtml);
    setRequireBeforePayment(row.requireBeforePayment);
    setEligibleTypeIds(row.eligibleTypeIds || []);
    setActive(row.active);
    setMessage(null);
  }

  async function save() {
    if (!name.trim() || !bodyHtml.trim()) {
      setMessage("Name and contract body are required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/appointments/service-booking/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing?.id,
        name: name.trim(),
        version: version.trim() || "1",
        bodyHtml,
        requireBeforePayment,
        eligibleTypeIds,
        active,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Contract template saved.");
    startNew();
    void load();
  }

  function toggleType(id: string) {
    setEligibleTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href="/appointments/booking" className="underline">Booking Pages</Link>
          {" / "}Contracts
        </p>
        <h1 className="text-2xl font-semibold mt-1">Contracts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create service agreements customers sign after booking. Assign templates to booking types
          below.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold">
          {editing ? "Edit contract template" : "New contract template"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Contract name</span>
            <input className="rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Version</span>
            <input className="rounded-md border px-3 py-2" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span>Contract body</span>
            <textarea
              className="rounded-md border px-3 py-2 min-h-[160px] font-mono text-xs"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Automatically request for</legend>
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">No booking types yet.</p>
          ) : (
            types.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={eligibleTypeIds.includes(t.id)}
                  onChange={() => toggleType(t.id)}
                />
                {t.name}
              </label>
            ))
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requireBeforePayment}
            onChange={(e) => setRequireBeforePayment(e.target.checked)}
          />
          Require signature before payment (when supported by booking flow)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save template"}
          </button>
          {editing ? (
            <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={startNew}>
              Cancel edit
            </button>
          ) : null}
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Templates</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">No contracts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a template when customers must sign a service agreement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Version</th>
                  <th scope="col" className="px-4 py-3 font-medium">Booking types</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.version}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {(row.eligibleTypeIds || []).length || "None assigned"}
                    </td>
                    <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-indigo-600 underline" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
