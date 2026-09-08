import { Globe } from "lucide-react";
import type { BookingRulesModel } from "@/features/appointments/kimi/availability/types";

interface Props {
  rules: BookingRulesModel;
  onTimezoneChange: (value: string) => void;
  onMinimumNoticeChange: (value: number) => void;
  onMaximumDaysChange: (value: number) => void;
}

export default function BookingRules({
  rules,
  onTimezoneChange,
  onMinimumNoticeChange,
  onMaximumDaysChange,
}: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-1">
      <div className="avail-card-header">
        <div className="flex items-start gap-3">
          <span className="avail-icon-chip mt-0.5">
            <Globe size={15} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-semibold text-[#1c1a2e]">Booking rules</h2>
            <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
              These rules apply to all booking channels in this workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-[22px] py-5">
        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2">Timezone</label>
          <input
            className="avail-input w-full font-medium"
            value={rules.timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
          />
          <p className="text-[12px] text-[#8a87a0] mt-2">All times below use this timezone.</p>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2" htmlFor="avail-minimum-notice">
            Minimum notice
          </label>
          <div className="avail-input w-full flex items-center justify-between">
            <input
              id="avail-minimum-notice"
              name="minimumBookingNotice"
              type="number"
              min={0}
              className="w-20 bg-transparent font-medium outline-none"
              value={rules.minimumNotice}
              onChange={(e) => onMinimumNoticeChange(Number(e.target.value) || 0)}
            />
            <span className="text-[#8a87a0]">{rules.minimumNoticeUnit}</span>
          </div>
          <p className="text-[12px] text-[#8a87a0] mt-2">How far ahead bookings must be made.</p>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2">Booking horizon</label>
          <div className="avail-input w-full flex items-center justify-between">
            <input
              type="number"
              min={1}
              className="w-20 bg-transparent font-medium outline-none"
              value={rules.bookingHorizon}
              onChange={(e) => onMaximumDaysChange(Number(e.target.value) || 1)}
            />
            <span className="text-[#8a87a0]">{rules.bookingHorizonUnit}</span>
          </div>
          <p className="text-[12px] text-[#8a87a0] mt-2">Farthest date customers can book.</p>
        </div>
      </div>
    </section>
  );
}
