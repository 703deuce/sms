import {
  CreditCard,
  Forward,
  Hash,
  LayoutDashboard,
  Phone,
  Sparkles,
  Vault,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export function buildPersonalNav(): NavItem[] {
  return [
    { label: "Overview", href: "/personal", icon: LayoutDashboard },
    { label: "My Numbers", href: "/personal/numbers", icon: Phone },
    { label: "Find a Number", href: "/personal/numbers/find", icon: Hash },
    {
      label: "Premium Numbers",
      href: "/personal/numbers/premium",
      icon: Sparkles,
      badge: "NEW",
    },
    { label: "Number Vault", href: "/personal/vault", icon: Vault },
    { label: "Call Forwarding", href: "/personal/forwarding", icon: Forward },
    { label: "Voicemail", href: "/personal/voicemail", icon: Voicemail },
    { label: "Porting", href: "/personal/porting", icon: Phone },
    { label: "Billing / Plan", href: "/personal/billing", icon: CreditCard },
  ];
}

export function getPersonalPageTitle(pathname: string): string {
  if (pathname === "/personal") return "Overview";
  if (pathname === "/personal/numbers") return "My Numbers";
  if (pathname.startsWith("/personal/numbers/find")) return "Find a Number";
  if (pathname.startsWith("/personal/numbers/premium")) return "Premium Numbers";
  if (pathname.match(/^\/personal\/numbers\/[^/]+$/)) return "Number Details";
  if (pathname === "/personal/vault") return "Number Vault";
  if (pathname === "/personal/forwarding") return "Call Forwarding";
  if (pathname === "/personal/voicemail") return "Voicemail";
  if (pathname === "/personal/porting") return "Porting";
  if (pathname === "/personal/billing") return "Billing / Plan";
  return "Personal";
}
