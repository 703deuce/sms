"use client";

import { useCallback, useEffect, useState } from "react";

type ContractData = {
  templateName: string;
  businessName: string;
  bodyHtml: string;
  status: string;
  signedAt: string | null;
  signerName: string | null;
  templateVersion: string;
};

export default function ContractSignPublicClient({ token }: { token: string }) {
  const [data, setData] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/contracts/sign/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Contract not found");
    setData(json.data);
  }, [token]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function sign() {
    if (!signerName.trim()) {
      setMessage("Enter your full name to sign.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/contracts/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not sign contract");
      await load();
      setMessage("Contract signed. Thank you.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center">
          <h1 className="text-lg font-semibold">Contract unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">Loading contract…</p>
      </main>
    );
  }

  const signed = data.status === "signed";

  return (
    <main className="min-h-screen bg-[#f7f6fb] py-10 px-4">
      <article className="max-w-2xl mx-auto rounded-xl border bg-white shadow-sm overflow-hidden">
        <header className="border-b px-6 py-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">{data.businessName}</p>
          <h1 className="text-xl font-semibold mt-1">{data.templateName}</h1>
          <p className="text-xs text-gray-500 mt-1">Version {data.templateVersion}</p>
        </header>
        <div
          className="px-6 py-5 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
        />
        <footer className="border-t px-6 py-5 bg-gray-50 space-y-4">
          {signed ? (
            <p className="text-sm font-medium text-green-800">
              Signed by {data.signerName}
              {data.signedAt
                ? ` on ${new Date(data.signedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span>Your full name</span>
                <input
                  className="rounded-md border px-3 py-2"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <button
                type="button"
                className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void sign()}
              >
                {busy ? "Signing…" : "Sign contract"}
              </button>
            </>
          )}
          {message ? <p className="text-sm text-gray-600">{message}</p> : null}
        </footer>
      </article>
    </main>
  );
}
