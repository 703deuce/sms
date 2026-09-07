import type { BookingType } from "../mock-data";
import { Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { formatPrice } from "./utils";

export function ServiceStep({
  types,
  onPick,
}: {
  types: BookingType[];
  onPick: (type: BookingType) => void;
}) {
  return (
    <div className="fade-in">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
        Book an appointment
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Choose a service to see available times.
      </p>

      <ul className="mt-5 space-y-3" role="list">
        {types.map((type) => {
          const price = formatPrice(type.config?.payment);
          return (
            <li key={type.id}>
              <button
                type="button"
                onClick={() => onPick(type)}
                className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {type.name}
                    </p>
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
        })}
      </ul>
    </div>
  );
}
