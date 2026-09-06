import { ArrowRight, type LucideIcon } from "lucide-react";

export function RecallFeatureCard({
  icon: Icon,
  title,
  description,
  meta,
  cta,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  cta: string;
  href: string;
}) {
  return (
    <a className="tv-card" href={href}>
      <span className="tv-card-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <h3 className="tv-card-title">{title}</h3>
      <p className="tv-card-desc">{description}</p>
      <div className="tv-card-meta">
        <span>{meta}</span>
        <span className="tv-card-link">
          {cta}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}
