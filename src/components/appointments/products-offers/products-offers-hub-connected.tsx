"use client";

import Link from "next/link";
import { ArrowLeft, Gift, Percent, ShoppingBag, ShoppingCart, Tag } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import "@/components/appointments/kimi-ui/overview/reference.css";

type HubCard = {
  title: string;
  description: string;
  manageHref: string;
  createHref: string;
  manageLabel: string;
  createLabel: string;
  icon: React.ReactNode;
};

const CARDS: HubCard[] = [
  {
    title: "Gift Cards",
    description: "Sell prepaid value customers can use later.",
    manageHref: "/appointments/gift-cards",
    createHref: "/appointments/gift-cards?create=1",
    manageLabel: "Manage gift cards",
    createLabel: "Create gift card",
    icon: <Gift size={20} aria-hidden />,
  },
  {
    title: "Products",
    description: "Sell simple retail products online or at checkout.",
    manageHref: "/appointments/products",
    createHref: "/appointments/products?create=1",
    manageLabel: "Manage products",
    createLabel: "Add product",
    icon: <ShoppingBag size={20} aria-hidden />,
  },
  {
    title: "Discounts",
    description: "Create coupon codes and discounts for bookings or purchases.",
    manageHref: "/appointments/discounts",
    createHref: "/appointments/discounts?create=1",
    manageLabel: "Manage discounts",
    createLabel: "Create discount",
    icon: <Percent size={20} aria-hidden />,
  },
  {
    title: "Point of Sale",
    description: "Charge customers in person for services, packages, memberships, gift cards, or products.",
    manageHref: "/appointments/pos",
    createHref: "/appointments/pos",
    manageLabel: "Open Point of Sale",
    createLabel: "Open Point of Sale",
    icon: <ShoppingCart size={20} aria-hidden />,
  },
];

export function ProductsOffersHubConnected() {
  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/overview" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Overview
      </Link>

      <RefDecoPageHeader
        title="Products & Offers"
        description="Gift cards, retail products, discounts, and in-person checkout — alongside packages and memberships."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/appointments/packages" className="appt-pilot-outline-btn"><Tag size={14} aria-hidden /> Packages</Link>
        <Link href="/appointments/memberships" className="appt-pilot-outline-btn"><Tag size={14} aria-hidden /> Memberships</Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {CARDS.map((card) => (
          <article key={card.title} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                {card.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="appt-pilot-text-section">{card.title}</h2>
                <p className="mt-1 appt-pilot-text-helper">{card.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={card.manageHref} className="appt-pilot-outline-btn">{card.manageLabel}</Link>
                  {card.title !== "Point of Sale" ? (
                    <Link href={card.createHref} className="appt-pilot-muted-link self-center">{card.createLabel}</Link>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-8 appt-pilot-text-helper rounded-lg border border-dashed border-[var(--border)] px-4 py-3">
        Legacy admin tools still available at{" "}
        <Link href="/appointments/commerce" className="appt-pilot-muted-link">Commerce (transitional)</Link>
        {" "}for unmigrated settings. Programs and Rewards are not part of this hub.
      </p>
    </div>
  );
}
