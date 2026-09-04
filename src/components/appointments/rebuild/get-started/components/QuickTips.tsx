import React from "react";
import Link from "next/link";
import { Clock, Send, ChevronRight, ExternalLink } from "lucide-react";
import type { QuickTip } from "../types";

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={16} />,
  send: <Send size={16} />,
};

export default function QuickTips({ tips }: { tips: QuickTip[] }) {
  return (
    <div className="card">
      <h3 className="card__title">Quick tips</h3>
      <div className="tips">
        {tips.map((tip) => (
          <Link key={tip.id} href={tip.href} className="tip">
            <span className="tip__icon">{iconMap[tip.icon]}</span>
            <span className="tip__text">
              <span className="tip__title">{tip.title}</span>
              <span className="tip__desc">{tip.description}</span>
            </span>
            <ChevronRight size={16} className="tip__chevron" />
          </Link>
        ))}
      </div>
      <Link href="/appointments/types" className="tips__learn">
        Learn more about appointments <ExternalLink size={12} />
      </Link>
    </div>
  );
}
