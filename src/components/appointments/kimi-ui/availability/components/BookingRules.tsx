import { Globe, Pencil, ChevronDown } from "lucide-react";
import { bookingRules } from "../mock-data";

export default function BookingRules() {
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
        <button className="avail-btn-ghost">
          <Pencil size={13} />
          Edit rules
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-[22px] py-5">
        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2">Timezone</label>
          <button className="avail-input w-full flex items-center justify-between text-left font-medium">
            {bookingRules.timezone}
            <ChevronDown size={15} className="text-[#8a87a0]" />
          </button>
          <p className="text-[12px] text-[#8a87a0] mt-2">All times below use this timezone.</p>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2">Minimum notice</label>
          <div className="avail-input w-full flex items-center justify-between">
            <span className="font-medium">{bookingRules.minimumNotice}</span>
            <span className="text-[#8a87a0]">{bookingRules.minimumNoticeUnit}</span>
          </div>
          <p className="text-[12px] text-[#8a87a0] mt-2">How far ahead bookings must be made.</p>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#1c1a2e] mb-2">Booking horizon</label>
          <div className="avail-input w-full flex items-center justify-between">
            <span className="font-medium">{bookingRules.bookingHorizon}</span>
            <span className="text-[#8a87a0]">{bookingRules.bookingHorizonUnit}</span>
          </div>
          <p className="text-[12px] text-[#8a87a0] mt-2">Farthest date customers can book.</p>
        </div>
      </div>
    </section>
  );
}
