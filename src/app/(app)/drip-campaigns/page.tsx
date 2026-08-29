import {
  SlickAudienceHeader,
} from "@/components/audience/slick-audience-ui";
import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default function DripCampaignsPage() {
  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        title="Drip Campaigns"
        description="Send a linear series of timed messages after someone enters a drip."
        icon={Layers}
      />
      <Card className="rounded-xl border-slate-200 p-8 text-center shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">Coming next</p>
        <p className="mt-2 text-[13px] text-slate-500">
          Drip campaign builder and analytics are queued after Auto Replies ships.
        </p>
      </Card>
    </div>
  );
}
