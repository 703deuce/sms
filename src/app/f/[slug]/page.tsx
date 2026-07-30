"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type FormPublic = {
  name: string;
  disclosureText?: string | null;
  thankYouMessage?: string | null;
};

export default function PublicOptInFormPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const [form, setForm] = useState<FormPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/forms/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Form not found");
        return r.json();
      })
      .then((json) => setForm(json.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Form not found"));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/forms/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, firstName, consent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setDone(json.thankYouMessage || "Thanks!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !form) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <p className="text-slate-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transovo</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{form?.name || "Join our texts"}</h1>
        {done ? (
          <p className="mt-6 text-slate-700">{done}</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                required
                placeholder="+1…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span>{form?.disclosureText}</span>
            </label>
            <p className="text-xs text-slate-500">
              <a className="underline" href="/privacy">
                Privacy
              </a>{" "}
              ·{" "}
              <a className="underline" href="/terms">
                Terms
              </a>{" "}
              ·{" "}
              <a className="underline" href="/acceptable-use">
                Acceptable use
              </a>
            </p>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" disabled={submitting || !consent} className="w-full">
              {submitting ? "Submitting…" : "Subscribe"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
