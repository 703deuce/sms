"use client";

import { ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { formatPrice, type BookingType } from "../mock-data";

export default function ServiceStep({
  types,
  onPick,
}: {
  types: BookingType[];
  onPick: (type: BookingType) => void;
}) {
  return (
    <div>
      <h1 className="eb-title">Book an appointment</h1>
      <p className="eb-sub">Choose a service to get started. No account required.</p>
      <div role="list">
        {types.map((type) => {
          const price = formatPrice(type.config?.payment);
          return (
            <button
              key={type.id}
              type="button"
              role="listitem"
              className="eb-service"
              onClick={() => onPick(type)}
            >
              <span className="eb-service__body">
                <span className="eb-service__name">
                  {type.name}
                  {price ? <span className="eb-pill">{price}</span> : null}
                  {type.config?.groupBooking?.enabled ? (
                    <span className="eb-pill eb-pill--amber">Group</span>
                  ) : null}
                </span>
                {type.config?.description ? (
                  <span className="eb-service__desc">{type.config.description}</span>
                ) : null}
                <span className="eb-service__meta">
                  <span className="eb-service__meta-item">
                    <Clock size={13} aria-hidden /> {type.durationMinutes} min
                  </span>
                  {type.config?.location ? (
                    <span className="eb-service__meta-item">
                      <MapPin size={13} aria-hidden /> {type.config.location}
                    </span>
                  ) : null}
                  {type.config?.groupBooking?.enabled ? (
                    <span className="eb-service__meta-item">
                      <Users size={13} aria-hidden /> Up to{" "}
                      {type.config.groupBooking.capacity} per session
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRight size={17} className="eb-service__chev" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
