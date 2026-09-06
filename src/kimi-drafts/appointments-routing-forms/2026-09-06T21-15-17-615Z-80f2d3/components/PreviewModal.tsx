import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { RoutingForm } from "../mock-data";

type Props = {
  form: RoutingForm;
  onClose: () => void;
};

/**
 * Public routing form preview (/routing/[slug]/[formSlug]).
 * Shows exactly what a lead sees: headline, questions, consent, submit.
 */
export default function PreviewModal({ form, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function inputType(type: string) {
    if (type === "email") return "email";
    if (type === "phone") return "tel";
    if (type === "number") return "number";
    return "text";
  }

  function submit() {
    const next: Record<string, string> = {};
    form.fields.forEach((f) => {
      if (f.required && !(values[f.id] || "").trim()) next[f.id] = `Answer “${f.label}” to continue.`;
    });
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3 id="preview-title" className="font-display" style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              Public form preview
            </h3>
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
              /routing/{form.slug} — what your leads see. Changes here don't submit real data.
            </p>
          </div>
          <button ref={closeRef} className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close preview">
            <X size={16} />
          </button>
        </div>

        <div className="preview-frame">
          {!form.active && (
            <div className="preview-banner" role="status">
              This form is currently inactive. Visitors see a “form unavailable” page instead of this form.
            </div>
          )}

          {submitted ? (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "hsl(var(--success) / 0.12)",
                  color: "hsl(var(--success))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  margin: "0 auto 12px",
                }}
              >
                ✓
              </div>
              <h4 className="font-display" style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>
                Thanks — we've got your answers
              </h4>
              <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 16px" }}>
                Based on your answers, you'd be routed to the matching booking page. Pick a time that works for you.
              </p>
              <button className="btn btn-primary" onClick={() => setSubmitted(false)}>
                Preview again
              </button>
            </div>
          ) : (
            <fieldset disabled={!form.active} style={{ border: "none", padding: 0, margin: 0, opacity: form.active ? 1 : 0.6 }}>
              <h4 className="font-display" style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px", textAlign: "center" }}>
                {form.headline || "How can we help you?"}
              </h4>
              <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 18px", textAlign: "center" }}>
                Answer a few questions and we'll take you to the right booking page.
              </p>

              {form.fields.map((f) => (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    {f.label}
                    {f.required ? "" : <span className="text-muted-foreground" style={{ fontWeight: 400 }}> — Optional</span>}
                  </label>
                  {f.options?.length ? (
                    <select
                      className="input"
                      value={values[f.id] || ""}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={inputType(f.type)}
                      value={values[f.id] || ""}
                      placeholder={f.type === "email" ? "name@example.com" : f.type === "phone" ? "(571) 555-1234" : ""}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                    />
                  )}
                  {errors[f.id] && (
                    <p style={{ fontSize: 12, color: "hsl(var(--danger))", margin: "4px 0 0" }} role="alert">
                      {errors[f.id]}
                    </p>
                  )}
                </div>
              ))}

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, margin: "4px 0 16px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span className="text-muted-foreground">
                  I agree to receive appointment-related text messages at the number I provided. Message and data rates may apply.
                  Reply STOP to opt out. View our Terms and Privacy Policy.
                </span>
              </label>

              <button className="btn btn-primary" style={{ width: "100%" }} onClick={submit}>
                Continue
              </button>
            </fieldset>
          )}
        </div>
      </div>
    </div>
  );
}
