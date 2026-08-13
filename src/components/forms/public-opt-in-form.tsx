"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FIELD_LABELS, type FormFieldKey } from "@/lib/forms/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type PublicFormData = {
  name: string;
  slug?: string;
  disclosureText?: string | null;
  thankYouMessage?: string | null;
  fields?: FormFieldKey[];
  branding?: {
    businessName?: string;
    primaryColor?: string;
    accentColor?: string;
    theme?: "light" | "dark";
    logoUrl?: string | null;
  };
  headline?: string;
  subheadline?: string;
  buttonLabel?: string;
  ageGateMinAge?: number;
};

export function PublicOptInForm({
  variant = "hosted",
  slug: slugProp,
}: {
  variant?: "hosted" | "embed";
  slug?: string;
}) {
  const params = useParams();
  const slug = slugProp || String(params.slug || "");
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
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

  const fields = form?.fields || ["firstName", "phone"];
  const primary = form?.branding?.primaryColor || "#6366f1";
  const isDark = form?.branding?.theme === "dark";

  const shellClass = useMemo(
    () =>
      isDark
        ? "bg-slate-950 text-slate-100"
        : "bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900",
    [isDark],
  );

  const cardClass = isDark
    ? "border-slate-800 bg-slate-900 shadow-xl shadow-black/20"
    : "border-slate-200/80 bg-white shadow-xl shadow-slate-200/60";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/forms/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: values.phone,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          dateOfBirth: values.dateOfBirth,
          consent,
          embedHost: variant === "embed" ? window.location.hostname : undefined,
        }),
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
      <main className={`flex min-h-screen items-center justify-center px-4 ${shellClass}`}>
        <p className="text-slate-500">{error}</p>
      </main>
    );
  }

  return (
    <main
      className={`${variant === "embed" ? "min-h-[480px]" : "min-h-screen"} flex flex-col justify-center px-4 py-8 ${shellClass}`}
    >
      <div className="mx-auto w-full max-w-md">
        <div className={`rounded-2xl border p-6 sm:p-8 ${cardClass}`}>
          <div className="mb-6 flex items-center gap-3">
            {form?.branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.branding.logoUrl}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                {(form?.branding?.businessName || "T").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {form?.branding?.businessName || "Transovo"}
              </p>
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
                {form?.headline || form?.name || "Join our list"}
              </h1>
            </div>
          </div>

          {form?.subheadline ? (
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{form.subheadline}</p>
          ) : null}

          {done ? (
            <div className="rounded-xl bg-violet-50 px-4 py-6 text-center dark:bg-violet-950/40">
              <p className="text-base font-medium text-violet-800 dark:text-violet-200">{done}</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {fields.map((field) => {
                if (field === "phone") {
                  return (
                    <div key={field}>
                      <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                      <Input
                        id={field}
                        required
                        type="tel"
                        autoComplete="tel"
                        placeholder="(555) 123-4567"
                        className="mt-1"
                        value={values.phone || ""}
                        onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                      />
                    </div>
                  );
                }
                if (field === "dateOfBirth") {
                  return (
                    <div key={field}>
                      <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                      <Input
                        id={field}
                        required={Boolean(form?.ageGateMinAge)}
                        type="date"
                        className="mt-1"
                        value={values.dateOfBirth || ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, dateOfBirth: e.target.value }))
                        }
                      />
                    </div>
                  );
                }
                return (
                  <div key={field}>
                    <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                    <Input
                      id={field}
                      type={field === "email" ? "email" : "text"}
                      autoComplete={field}
                      className="mt-1"
                      value={values[field] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                    />
                  </div>
                );
              })}

              <label className="flex items-start gap-3 text-sm leading-snug text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>{form?.disclosureText}</span>
              </label>

              <p className="text-xs text-slate-500">
                <Link className="underline hover:text-slate-700" href="/privacy">Privacy</Link>
                {" · "}
                <Link className="underline hover:text-slate-700" href="/terms">Terms</Link>
                {" · "}
                <Link className="underline hover:text-slate-700" href="/acceptable-use">Acceptable use</Link>
              </p>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button
                type="submit"
                disabled={submitting || !consent}
                className="w-full text-white"
                style={{ backgroundColor: primary }}
              >
                {submitting ? "Submitting…" : form?.buttonLabel || "Subscribe"}
              </Button>
            </form>
          )}
        </div>

        {variant === "hosted" ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Powered by Transovo SMS
          </p>
        ) : null}
      </div>
    </main>
  );
}
