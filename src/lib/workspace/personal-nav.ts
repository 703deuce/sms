import {
  CreditCard,
  Forward,
  Hash,
  LayoutDashboard,
  Phone,
  Vault,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** Compact Personal sidebar — shared pages reuse business/premium infrastructure */
export function buildPersonalNav(): NavItem[] {
  return [
    { label: "Overview", href: "/personal", icon: LayoutDashboard },
    { label: "My Numbers", href: "/personal/numbers", icon: Phone },
    { label: "Find a Number", href: "/personal/numbers/premium", icon: Hash },
    { label: "Number Vault", href: "/personal/vault", icon: Vault },
    { label: "Forwarding", href: "/personal/forwarding", icon: Forward },
    { label: "Voicemail", href: "/personal/voicemail", icon: Voicemail },
    { label: "Porting", href: "/personal/porting", icon: Phone },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
  ];
}

export function getPersonalPageTitle(pathname: string): string {
  if (pathname === "/personal") return "";
  if (pathname === "/personal/numbers") return "My Numbers";
  if (pathname.startsWith("/personal/numbers/premium")) return "";
  if (pathname.match(/^\/personal\/numbers\/[^/]+$/)) return "Number Details";
  if (pathname === "/personal/vault") return "";
  if (pathname === "/personal/forwarding") return "";
  if (pathname === "/personal/voicemail") return "";
  if (pathname === "/personal/porting") return "Porting";
  return "";
}
