import { useMemo, useState } from "react";
import type { BookingType } from "../mock-data";
import type { PublicCatalogTerminology } from "@/lib/appointments/public-booking-catalog";
import {
  actionLabelForType,
  isWorkshopEventType,
  publicCatalogGroup,
  resolvePublicTerminology,
} from "@/lib/appointments/public-booking-catalog";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
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

function OfferingCard({
  type,
  actionLabel,
  onPick,
}: {
  type: BookingType;
  actionLabel: string;
  onPick: (type: BookingType) => void;
}) {
  const price = formatPrice(type.config?.payment);
  const kind = type.bookingTypeKind || resolveBookingTypeKind(type.config as never);
  const isMeeting = kind === "MEETING";
  const isWorkshop = isWorkshopEventType(type.config as never);

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
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {type.durationMinutes} min
              </span>
              {type.config?.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {type.config.location}
                </span>
              ) : null}
              {type.config?.groupBooking?.enabled && !isWorkshop ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Up to{" "}
                  {(type.config.groupBooking as { capacity?: number; maxAttendees?: number }).capacity ||
                    (type.config.groupBooking as { maxAttendees?: number }).maxAttendees ||
                    1}
                </span>
              ) : null}
              {isMeeting ? (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Meeting</span>
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
                {isMeeting && price.toLowerCase().includes("free") ? "Free" : price}
              </span>
            ) : isMeeting ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-foreground">
                Free
              </span>
            ) : null}
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {actionLabel}
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
  terminology,
  classesUrl,
  hasClasses = false,
  onPick,
}: {
  types: BookingType[];
  categories?: ServiceCategory[];
  activeCategorySlug?: string;
  addingAdditional?: boolean;
  terminology?: PublicCatalogTerminology;
  classesUrl?: string;
  hasClasses?: boolean;
  onPick: (type: BookingType) => void;
}) {
  const terms = terminology || resolvePublicTerminology();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const topLevelGroups = useMemo(() => {
    if (addingAdditional) {
      return [{ id: "services", name: terms.serviceLabel, types }];
    }

    const meetings = types.filter((t) => publicCatalogGroup(t.config as never) === "meetings");
    const workshops = types.filter((t) => publicCatalogGroup(t.config as never) === "workshops");
    const services = types.filter((t) => publicCatalogGroup(t.config as never) === "services");

    const groups: Array<{ id: string; name: string; types: BookingType[] }> = [];
    if (meetings.length) groups.push({ id: "meetings", name: terms.meetingLabel, types: meetings });
    if (services.length) groups.push({ id: "services", name: terms.serviceLabel, types: services });
    if (workshops.length) groups.push({ id: "workshops", name: terms.workshopLabel, types: workshops });
    if (!groups.length && types.length) {
      groups.push({ id: "offerings", name: `Book ${terms.appointmentLabel}`, types });
    }
    return groups;
  }, [types, terms, addingAdditional]);

  const serviceCategorySections = useMemo(() => {
    const serviceTypes = topLevelGroups.find((g) => g.id === "services")?.types || [];
    if (!categories.length || !serviceTypes.length) return null;

    type Section = {
      id: string;
      name: string;
      description?: string | null;
      collapsible: boolean;
      types: BookingType[];
    };

    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const sections: Section[] = sorted.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      collapsible: cat.collapsible,
      types: serviceTypes.filter((t) => t.config?.categoryId === cat.id),
    }));
    const uncategorized = serviceTypes.filter(
      (t) => !t.config?.categoryId || !categories.some((c) => c.id === t.config?.categoryId),
    );
    if (uncategorized.length) {
      sections.push({
        id: "_other",
        name: `Other ${terms.serviceLabel.toLowerCase()}`,
        collapsible: false,
        types: uncategorized,
      });
    }
    if (activeCategorySlug) {
      const match = categories.find((c) => c.slug === activeCategorySlug || c.id === activeCategorySlug);
      if (match) return sections.filter((s) => s.id === match.id);
    }
    return sections.filter((s) => s.types.length > 0);
  }, [categories, topLevelGroups, activeCategorySlug, terms.serviceLabel]);

  const pageTitle = addingAdditional
    ? `Add another ${terms.serviceLabel.toLowerCase()}`
    : "What would you like to book?";
  const pageSubtitle = addingAdditional
    ? "Select an additional offering to book back-to-back in the same visit."
    : "Choose an option below to see available times.";

  const isEmpty =
    topLevelGroups.every((g) => g.types.length === 0) && !hasClasses && !addingAdditional;

  return (
    <div className="fade-in">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">{pageTitle}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{pageSubtitle}</p>

      {addingAdditional ? (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[12px] text-foreground">
          Adding another service — it will be scheduled immediately after your first appointment.
        </p>
      ) : null}

      <div className="mt-5 space-y-8">
        {topLevelGroups.map((group) => {
          if (group.id === "services" && serviceCategorySections?.length) {
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                <h2 id={`group-${group.id}`} className="mb-3 text-sm font-semibold text-foreground">
                  {group.name}
                </h2>
                <div className="space-y-6">
                  {serviceCategorySections.map((section) => {
                    const isCollapsed = section.collapsible && collapsed[section.id];
                    return (
                      <div key={section.id}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-[13px] font-semibold text-foreground">{section.name}</h3>
                            {section.description ? (
                              <p className="text-[12px] text-muted-foreground">{section.description}</p>
                            ) : null}
                          </div>
                          {section.collapsible ? (
                            <button
                              type="button"
                              aria-expanded={!isCollapsed}
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setCollapsed((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                              }
                            >
                              {isCollapsed ? "Show" : "Hide"}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                              />
                            </button>
                          ) : null}
                        </div>
                        {!isCollapsed ? (
                          <ul className="space-y-3" role="list">
                            {section.types.map((type) => (
                              <OfferingCard
                                key={type.id}
                                type={type}
                                actionLabel={actionLabelForType(type.config as never, terms)}
                                onPick={onPick}
                              />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (!group.types.length) return null;

          return (
            <section key={group.id} aria-labelledby={`group-${group.id}`}>
              <h2 id={`group-${group.id}`} className="mb-3 text-sm font-semibold text-foreground">
                {group.name}
              </h2>
              <ul className="space-y-3" role="list">
                {group.types.map((type) => (
                  <OfferingCard
                    key={type.id}
                    type={type}
                    actionLabel={actionLabelForType(type.config as never, terms)}
                    onPick={onPick}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {hasClasses && classesUrl && !addingAdditional ? (
          <section aria-labelledby="group-classes">
            <h2 id="group-classes" className="mb-3 text-sm font-semibold text-foreground">
              {terms.classLabel}
            </h2>
            <a
              href={classesUrl}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">View upcoming classes</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Join a scheduled class — pick a date and time from the class schedule.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {terms.joinClassButtonLabel}
              </span>
            </a>
          </section>
        ) : null}

        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            This business doesn&apos;t have anything available to book online right now.
          </p>
        ) : null}
      </div>
    </div>
  );
}
