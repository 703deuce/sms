"use client";

/**
 * Shared form primitives for the bookable-object editors.
 *
 * The Meetings and Services workspaces have moved to the shared primitives in
 * @/components/appointments/workspace-ui; these remain for the Classes editor.
 */

export function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ref-deco-section" aria-labelledby={id}>
      <div className="ref-deco-section-head">
        <div className="flex items-center gap-2">
          <div className="ref-deco-section-accent" aria-hidden />
          <div>
            <h2 id={id} className="appt-pilot-text-section">{title}</h2>
            {description ? <p className="appt-pilot-text-helper mt-0.5">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="ref-deco-section-body space-y-4">{children}</div>
    </section>
  );
}

export function PilotLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="label block appt-pilot-text-list font-medium text-[var(--text-primary)] mb-1.5" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function PilotInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input w-full appt-pilot-text-list ${props.className || ""}`} />;
}

export function PilotSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input w-full appt-pilot-text-list ${props.className || ""}`} />;
}

export function PilotTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input w-full resize-none appt-pilot-text-list ${props.className || ""}`} />;
}
