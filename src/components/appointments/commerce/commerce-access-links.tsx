"use client";

import Link from "next/link";

/** Contextual links from Service/Class editor to canonical commerce homes. */
export function CommerceAccessLinks() {
  return (
    <section className="rounded-xl border border-[#ecedf2] p-4">
      <h3 className="text-[14px] font-semibold mb-1">Pricing &amp; access</h3>
      <p className="text-[12.5px] text-[#8a8fa3] mb-3">
        Packages and memberships are managed on their own pages. Link eligible bundles here when your pricing model supports them.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/appointments/packages"
          className="rounded-full border border-[#e4e6ee] px-3 py-1.5 text-[12px] font-medium text-[#5b4bff] hover:bg-[#f7f6ff]"
        >
          Manage packages
        </Link>
        <Link
          href="/appointments/memberships"
          className="rounded-full border border-[#e4e6ee] px-3 py-1.5 text-[12px] font-medium text-[#5b4bff] hover:bg-[#f7f6ff]"
        >
          Manage memberships
        </Link>
        <Link
          href="/appointments/discounts"
          className="rounded-full border border-[#e4e6ee] px-3 py-1.5 text-[12px] font-medium text-[#5b4bff] hover:bg-[#f7f6ff]"
        >
          Manage discounts
        </Link>
      </div>
    </section>
  );
}
