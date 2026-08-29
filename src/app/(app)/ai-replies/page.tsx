import { SlickAudienceHeader } from "@/components/audience/slick-audience-ui";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AiRepliesPage() {
  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        title="AI Replies"
        description="Let AI respond conversationally to incoming text messages."
        icon={Sparkles}
      />
      <Card className="rounded-xl border-slate-200 p-8 text-center shadow-sm">
        <p className="text-[15px] font-semibold text-slate-900">Coming next</p>
        <p className="mt-2 text-[13px] text-slate-500">
          AI reply settings and inbox handoff controls will land after Drip Campaigns.
        </p>
      </Card>
    </div>
  );
}
