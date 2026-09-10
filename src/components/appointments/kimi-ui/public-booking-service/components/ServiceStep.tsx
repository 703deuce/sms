import { useMemo, useState } from "react";
import type { BookingType } from "../mock-data";
import { Clock, MapPin, Users, ChevronRight, ChevronDown } from "lucide-react";
import { formatPrice } from "./utils";

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder: number;
  collapsible: boolean;
  collapsedByDefault: boolean;
  imageUrl?: string | null;
};

function ServiceCard({ type, onPick }: { type: BookingType; onPick: (type: BookingType) => void }) {
  const price = formatPrice(type.config?.payment);
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(type)}
        className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          {type.config?.imageUrl ? (
            <img
              src={type.config.imageUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary">{type.name}</p>
            {type.config?.description ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                {type.config.description}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {type.durationMinutes} min
              </span>
              {type.config?.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {type.config.location}
                </span>
              ) : null}
              {type.config?.groupBooking?.enabled ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Up to {type.config.groupBooking.maxAttendees}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {type.config?.priceDisplay ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-foreground">
                {type.config.priceDisplay}
              </span>
            ) : price ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-foreground">
                {price}
              </span>
            ) : null}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/8 text-primary transition-transform duration-150 group-hover:translate-x-0.5">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

export function ServiceStep({
  types,
  categories = [],
  activeCategorySlug,
  addingAdditional = false,
  bookingSlug,
  onPick,
}: {
  types: BookingType[];
  categories?: ServiceCategory[];
  activeCategorySlug?: string;
  addingAdditional?: boolean;
  bookingSlug?: string;
  onPick: (type: BookingType) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const cat of categories) {
      if (cat.collapsible) init[cat.id] = cat.collapsedByDefault;
    }
    return init;
  });

  const grouped = useMemo(() => {
    type Section = {
      id: string;
      name: string;
      description?: string | null;
      collapsible: boolean;
      types: BookingType[];
    };

    if (!categories.length) {
      return [{ id: "_all", name: "Services", collapsible: false, types }] satisfies Section[];
    }
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const sections: Section[] = sorted.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      collapsible: cat.collapsible,
      types: types.filter((t) => t.config?.categoryId === cat.id),
    }));
    const uncategorized = types.filter(
      (t) => !t.config?.categoryId || !categories.some((c) => c.id === t.config?.categoryId),
    );
    if (uncategorized.length) {
      sections.push({
        id: "_other",
        name: "Other services",
        collapsible: false,
        types: uncategorized,
      });
    }
    if (activeCategorySlug) {
      const match = categories.find((c) => c.slug === activeCategorySlug || c.id === activeCategorySlug);
      if (match) return sections.filter((s) => s.id === match.id);
    }
    return sections.filter((s) => s.types.length > 0);
  }, [types, categories, activeCategorySlug]);

  return (
    <div className="fade-in">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
        Book an appointment
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {addingAdditional
          ? "Select an additional service to book back-to-back in the same visit."
          : "Choose a service to see available times."}
      </p>

      {addingAdditional ? (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[12px] text-foreground">
          Adding another service — it will be scheduled immediately after your first appointment.
        </p>
      ) : null}

      <div className="mt-5 space-y-6">
        {grouped.map((section) => {
          const isCollapsed = section.collapsible && collapsed[section.id];
          return (
            <section key={section.id} aria-labelledby={`cat-${section.id}`}>
              {categories.length > 0 ? (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 id={`cat-${section.id}`} className="text-sm font-semibold text-foreground">
                      {section.name}
                    </h2>
                    {section.description ? (
                      <p className="text-[12px] text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>
                  {section.collapsible ? (
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      aria-controls={`cat-list-${section.id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                    >
                      {isCollapsed ? "Show" : "Hide"}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!isCollapsed ? (
                <ul id={`cat-list-${section.id}`} className="space-y-3" role="list">
                  {section.types.map((type) => (
                    <ServiceCard key={type.id} type={type} onPick={onPick} />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services are available right now.</p>
        ) : null}
      </div>

      {bookingSlug && !addingAdditional ? (
        <nav className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4 text-[13px]" aria-label="Other booking options">
          <a href={`/book/${bookingSlug}/classes`} className="font-semibold text-primary hover:underline">
            Browse classes
          </a>
          <a href={`/book/${bookingSlug}/events`} className="font-semibold text-primary hover:underline">
            Events &amp; workshops
          </a>
          <a href={`/book/${bookingSlug}/store`} className="font-semibold text-primary hover:underline">
            Packages &amp; gifts
          </a>
          <a href={`/book/${bookingSlug}/ai-email`} className="font-semibold text-primary hover:underline">
            Email scheduling
          </a>
        </nav>
      ) : null}
    </div>
  );
}
