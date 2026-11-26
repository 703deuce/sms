# Agent egress: how to get AgentLab past datacenter-IP blocks, cheaply and at scale

Prepared 2026-11-24 (America/New_York) for John Jones / Transovo AI. **Research only.** Nothing was bought, signed up for, or configured. Prices are public list prices read from provider pages or third-party price trackers between Oct 6 and Nov 24, 2026. Provider prices change often, so re-check them on the day of any purchase.

Evidence labels used below:
- **[V]** read directly from the provider or primary source.
- **[T]** a third-party benchmark or price tracker.
- **[I]** inference or my own estimate.

---

## 0. Executive summary

1. **The IP is only half of the problem.** The server's Hetzner IP is the first thing YouTube rejects (yt-dlp gets the bot check on the first request from hosting ranges [T], §1). But sites also check the TLS/HTTP2 fingerprint, the browser fingerprint, headless tells, geo/timezone consistency and account history. A clean IP with a sloppy browser still gets challenged. Both halves have to be fixed.
2. **Mobile is not worth the premium as the default.**
   - Independent 2026 tests put mobile and residential almost level on hard targets: median real-target success was 75.3% for mobile and 74.4% for residential (Proxyway PMR 2026, as summarized by a secondary source) [T].
   - Mobile costs 1.1–2× as much per GB and is slower.
   - Carrier IPs shared through CGNAT also rate-limit more, and their city geolocation is unreliable.
   - Use mobile as an **escalation tier** for the few flows where a sticky residential IP keeps getting challenged. For mobile, **DataImpulse at $2/GB** is the cheapest credible option.
3. **Cheapest viable setup.** Run direct by default. Send only an allowlist of hard sites (YouTube, Amazon, social, travel and similar) through a **sticky, region-pinned residential proxy**. Residential at **$1/GB, pay-as-you-go with no minimum** (DataImpulse) is the cheapest credible per-GB option [V]. Escalate to mobile at $2/GB, and consider flat-rate ISP/static IPs for heavy downloads (§2).
4. **Cost at scale.** With blocking of images/media, caching and plan caps, the modeled cost is **about $1.2–3.7 per user per month** (about 3–10% of revenue). That range runs from 100 users to 10,000 users, using the hybrid DataImpulse option and assuming 50–100% of users touch proxied sites in a month (§6). A per-plan table is in §6.
5. **Do not build a mobile modem farm yet.** DIY costs about $23–28 per modem per month, plus hardware and labor, and US "unlimited" consumer SIM terms generally forbid proxy use. It only beats buying above roughly **150–300 GB per month in one region**, and only after the product has proven demand (§3).
6. **How big agent platforms actually do it** (the evidence is better than expected, §2.6):
   - **Manus** documents that its cloud browser uses datacenter IPs. For hard sites it tells users to switch to "My Browser", which runs on the user's own machine and home IP [V].
   - **OpenAI's** cloud browser signs its requests with Web Bot Auth so that sites and CDNs can allowlist it [V].
   - **Browser-infrastructure vendors** resell residential proxies at $5–12/GB [T].
   - Grok Bot's own computer exits through a Charter home line (confirmed today: AS11427 Charter Communications). That is why it works, and it doesn't scale.

   So there are three more ways to get past blocks besides buying proxies. Two cost nothing: customer-device egress (the agent's browser exits through the customer's own computer) and signed-agent identity. The third is official APIs.
7. **Recommended pilot: about $136 over 2 weeks** (§7): DataImpulse residential and mobile top-ups, plus Decodo and Webshare ISP as cross-checks. Needs John's approval before anything is bought.
8. **New risk, found in this research.** Residential proxy pools have been raided or disrupted this year:
   - Google/FBI took down **NetNut** (July 2, 2026).
   - Google disrupted **IPIDEA** (Jan 2026).
   - **Bright Data** now requires company KYC for residential access, and **closed mobile proxies to new customers in April 2026**.

   Pool provenance and vendor concentration are real business risks. Build a thin gateway so providers can be swapped (§5, §7).

---

## 1. How sites detect bots beyond the IP

Detection stacks combine server-side signals (visible on the first packet, hard to forge, but coarse) with client-side signals (JavaScript runs in the browser, finer, but untrusted). The decisive step is **reconciliation**. A single mismatch between the two views sinks the session [T: crawlex].

| Layer | What is checked | Why an IP alone can't fix it |
|---|---|---|
| **IP / ASN reputation** | Hosting ranges (Hetzner, AWS, DO) vs consumer ISP vs carrier. YouTube and Amazon flag hosting ranges on the very first request [T: hproxy test 2026-09-19]. | This is the only layer a proxy changes. |
| **TLS fingerprint (JA3/JA4)** | Cipher list, extensions, ALPN in the ClientHello. Cloudflare also adds "JA4 Signals": one-hour global aggregates such as browser ratio, request volume and UA/IP/path diversity [V: Cloudflare blog]. | `curl`/Python/Go have non-browser fingerprints. A **real Chrome** has the right one, which is why the agent must drive real Chrome, not an HTTP library. |
| **HTTP/2 / HTTP/3 fingerprint** | SETTINGS values/order, WINDOW_UPDATE, PRIORITY, pseudo-header order [T: crawlex]. | A Chrome User-Agent with a non-Chrome HTTP/2 profile is a strong mismatch. Real Chrome passes. |
| **Browser fingerprint (JS)** | Canvas/WebGL/GPU, fonts, screen, `navigator.*`, plugins, audio, `navigator.platform` vs User-Agent consistency. | Container defaults (software GL, no fonts, UTC) look synthetic. |
| **Headless / automation tells** | `HeadlessChrome` in UA/Client Hints, missing Accept-Language, `navigator.webdriver`, CDP `Runtime.enable` side effects, Playwright globals [T: crawlex, cdpfleet]. | Fixable in the browser. A proxy does nothing. |
| **Geo/locale consistency** | Timezone, locale, language and geolocation compared with the IP's location. A UTC/en-US browser on a foreign IP is suspicious [T: browserscan.in, apostate]. | AgentLab's server is in Finland. A US exit IP with a Helsinki timezone is a classic mismatch. |
| **Network leaks** | WebRTC/STUN leaking the real IP, DNS resolved outside the proxy, QUIC/UDP bypassing the proxy [T: proxyudp]. | A proxy only covers what is routed through it. |
| **Behavior** | Request rate, mouse/scroll timing, perfect linear navigation, no think time. | Needs pacing and human-like interaction. |
| **Account / session history** | Account age, login history, payment history, previous flags. Changing IP mid-login or mid-checkout triggers re-verification [T: proxyudp]. | Account history is outside the network layer. This is why signed-in flows need session consistency. |
| **YouTube-specific** | PO tokens and player-client attestation on top of IP score. A proxy "does not change the client fingerprint, the missing PO token or an outdated yt-dlp" [T: tunelio]. | Even a perfect residential IP can still 403 if yt-dlp/PO-token handling is stale. |

**What the browser side must do (checklist for the egress layer):**
1. Use **real Chrome in headed mode** on a virtual display (Xvfb or the desktop session AgentLab already has), not headless Chromium. Keep it current, and keep the OS, fonts and GPU stack plausible.
2. **Set timezone, locale, Accept-Language and geolocation to match the exit IP.** The exit IP's city and state decide them, not the server's. Do this per session.
3. Use a **persistent profile per customer**: cookies, localStorage and a stable fingerprint. One customer keeps one profile and one region. Never share profiles across customers.
4. **Close leaks.** Route DNS through the proxy (`socks5h`). Disable non-proxied WebRTC UDP (`--force-webrtc-ip-handling-policy=disable_non_proxied_udp`). Avoid QUIC bypass.
5. **Hold the IP steady across a login/checkout session** (sticky session; §4).
6. Use human-like pacing and normal navigation. Don't open many parallel tabs against one site from one IP.
7. For yt-dlp: `-4` (force IPv4), a sticky exit, current yt-dlp plus a JS runtime, `--skip-download` first to test cheaply. YouTube stream URLs are bound to the IP that fetched the manifest, so the manifest and the download must use the same sticky IP [T: hproxy, tunelio].

> **Implication:** buying proxies alone will not fix the YouTube sign-in wall in the server's browser. The test shows a datacenter IP is **sufficient** to get blocked, not that a clean IP is **sufficient** to get through.

---

## 2. Proxy types, reputation, and 2025–26 pricing

### 2.1 Block rates and reputation (credible sources)

Honest summary: **no credible 2026 source gives a YouTube-specific block rate by proxy type.** What exists:

- **YouTube + datacenter IPs:** blocked on the first request. Both yt-dlp test URLs got "Sign in to confirm you're not a bot" from a hosting IP [T: hproxy.com]. The yt-dlp maintainers say "YouTube blocks DigitalOcean" [V: yt-dlp issue #16870]. A datacenter proxy is the same category as the server and changes nothing [T: ytdlp.org].
- **YouTube + residential/mobile:** work, but IPs "wear out". A bot check can return a few hours later on the same IP, so start each job on a fresh sticky session [T: hproxy, tunelio]. Beware IPv6 exits, because YouTube scores a whole /64 as one address. Force IPv4.
- **Residential success on hard sites, US, Nov 2026:** AIMultiple tests Amazon, Instagram, TikTok, YouTube, X, DuckDuckGo and Wikipedia daily. Real page returned, not a CAPTCHA/login wall: **about 82–90% across Webshare, Byteful, Oxylabs, Apify, Decodo, NodeMaven**, at 1.3–2.3s [T: aimultiple.com/us-proxies].
- **Amazon, Oct 2026 (plain HTTP client with Chrome TLS, no JS):** 47.8–55.3% across 12 residential providers. Rates swung between 28% and 83% from run to run for every provider, which points to Amazon-side behavior, not provider quality [T: Floppydata benchmark]. This benchmark is run by a vendor that sells one of the products; treat it as indicative only. A browser-based flow should do better than a plain HTTP client.
- **Mobile vs residential, hard targets (Amazon/Google/Instagram), Proxyway PMR 2026:** mobile **75.26% median**, best 85.31% (DataImpulse). Residential **74.43% median**, best 81.23% (Byteful). Both fell sharply from 2025 (mobile 90.55%, residential 94.30%), which reflects anti-bot escalation across the whole industry [T: TorchProxies summarizing Proxyway; I could not open Proxyway's PMR directly, so verify before relying on it].
- **CGNAT trade-off:** blocking a shared carrier IP hurts real subscribers, so platforms tend to challenge sessions instead of banning the IP. But shared-IP rate limiting is more frequent (about 3× in one summary) [T: torchproxies, proxymint, proxyudp].

### 2.2 Type-by-type comparison

| | **Datacenter** | **Residential rotating** | **Residential sticky** | **ISP / static residential** | **Mobile (rotating/sticky)** |
|---|---|---|---|---|---|
| YouTube | Blocked on first request | Works; IPs wear out | Best for yt-dlp (same IP for manifest and download) | Works at first; a flagged IP stays flagged until replaced [T: globalcorpora] | Works |
| Amazon | Poor | About 50–90% depending on test | Better for signed-in flows | Best for long-lived signed-in sessions: one IP, one location, one history [T: duallogin/proxymint] | Similar to residential, with more rate-limiting; avoid reusing one exit across two accounts |
| Session stickiness | Static | Per request or short | Minutes to days (see 2.3) | Permanent (rented per month) | Up to ~2h typical on pools; dedicated ports keep an IP until the modem reconnects |
| Geo consistency | Perfect, but flagged | Pinnable to country/state/city, but exits vary | Pin state/city plus session ID | Perfect, fixed | Country is reliable; **city often is not**: the IP belongs to the carrier's core gateway and can move between cities after a rotation [T: proxyudp] |
| Speed | Fastest | 0.7–1.2s median (benchmarks); real targets about 3.2s | Same | Fast, stable | Slowest: 3.67s vs 3.21s residential (Proxyway PMR) |
| Billing | Per GB or per IP | Per GB | Per GB | Per IP per month, often "unlimited" bandwidth with a fair-use limit | Per GB, or per dedicated port per month |

### 2.3 Sticky session length, by provider

| Provider | Residential sticky | Mobile sticky |
|---|---|---|
| DataImpulse | Up to 120 min; average about 30 min [T] | Up to 120 min [V] |
| Decodo | Up to 24 hours (`sessionduration` up to 1440 min) [V: help.decodo.com] | Available |
| NodeMaven | 7-day "long session" mode [T: aimultiple] | Available |
| ProxyLane | Up to 72 hours (vendor claim) [V] | n/a |
| Floppydata benchmark: sticky stability | DataImpulse 87%, Decodo 83%, Oxylabs 81%, Evomi 80%, IPRoyal 80%, Webshare 77%, SOAX 70% [T] | n/a |

### 2.4 Pricing: residential (per GB, list, USD, before VAT)

| Provider | Pay-as-you-go / smallest | Mid volume | High volume | Minimum / notes |
|---|---|---|---|---|
| **DataImpulse** | **$1.00/GB** (Intro $5 for 5 GB, one-time per proxy type; later top-ups from $50) [V: help.dataimpulse.com, dataimpulse.com] | $1.00 | $0.80/GB at 1 TB ($800) | **No subscription**, traffic never expires. KYC "on request" [T: cellmast] |
| Evomi | $1.04/GB [T: Floppydata] | – | – | Pay-go |
| Geonode | $0.79/GB (97.1% success, lowest of 12) [T] | – | – | Lowest quality in the test |
| SOAX | $2.00–5.00/GB (country tiers; US is the priciest) [T] | $1.20 at 100 GB | $0.90 at 1 TB | Free "Sandbox" plan at pay-per-GB; credits expire 60 days; ID check [T] |
| Webshare | $3.50 at 5 GB [T] | $2.25 at 100 GB | $1.50 at 1 TB | Cheap, mid-pack performance |
| **Decodo** (ex-Smartproxy) | $4.00/GB pay-go; $3.75 for 3 GB plan [V: decodo.com] | $2.75 at 100 GB ($275/mo) | $2.50 at 250 GB; $2.00 at 1 TB ($2,000/mo) | Best infra success on YouTube in Proxyway's tests (99.92%) [T]; 14-day money back; risk-based KYC |
| Oxylabs | $6.00 at 5 GB | $4.50 at 100 GB | $2.50 at 1 TB | Company KYC; top-tier performance |
| IPRoyal | $5.95 at 5 GB | $4.55 at 100 GB | $3.15 at 1 TB | Lowest YouTube infra success in Proxyway's table (96.1%) |
| Proxy-Cheap, Rayobyte, ProxyEmpire | $3.5–8.5/GB (Floppydata prices) | – | – | ProxyEmpire is the most expensive of those tested |
| **Bright Data** | $4/GB pay-go (50% promo; list $8) | $3.50 at 141 GB ($499/mo) | $2.50 at 798 GB ($1,999/mo) | **Residential now needs company KYC reviewed by humans; no self-serve** [V: docs.brightdata.com] |
| Browser-vendor bundled (Browser Use $5, Anchor $8, Steel $6–10, Browserbase $10–12, Browserless $9–12) | $5–12/GB | – | – | Included free in Bright Data Scraping Browser and Kernel [T: roost.guide, proxylane] |

### 2.5 Pricing: mobile, ISP/static and datacenter

**Mobile, rotating (per GB):**

| Provider | Smallest | At ~50–100 GB | At volume | Notes |
|---|---|---|---|---|
| **DataImpulse** | **$2.00/GB** (Intro $5 for 2.5 GB; then $50 top-ups) | $2.00 | $1.60 at 1 TB ($1,600) | 16M+ mobile IPs, 120-min sticky, state/city/ASN targeting, no minimum [V: dataimpulse.com/mobile-proxies]. Best mobile in Proxyway's 2026 test (85.31%) [T] |
| Proxidize (managed) | $2.00 (25 GB) | $2.00 | $0.50 above 10 TB [T: cellmast] | Also a managed dedicated service: $59/proxy/month with a 50 GB fair-use cap [T] |
| ASocks | $3.00 | $3.00 | – | [T: cellmast] |
| Decodo | $4.00 pay-go | $3.00 at 50 GB; $2.75 at 100 GB | $2.25 at 500 GB ($1,125) | [T: scrapemeter] |
| NodeMaven | $4.25 (2 GB) | – | $2.20 at 1 TB | [T: cellmast] |
| SOAX | $5.00 (US tier) | $4.00 at 50 GB; $3.00 at 100 GB | $2.20 at 500 GB; $0.85 at $3,000/mo | Credits expire in 60 days |
| Proxy-Cheap | $5.99 flat at any size | $5.99 | $5.99 | [T] |
| IPRoyal | $6.80 (2 GB) | $5.60 at 50 GB; $5.20 at 100 GB | $5.20 | Dedicated mobile: from $130/month, $117 on 90-day [V: iproyal.com] |
| Oxylabs | $7.50 ($30 plan) | $6.67 at 50 GB; $5.00 at 100 GB | $3.50 above 714 GB | |
| ProxyEmpire | $9.00 | – | $4.00 at 1 TB | |
| Rayobyte | $250/mo for 83 GB | $5.00 | $0.95 at $2,500/mo | Sales-led |
| **Bright Data** | **Closed to new customers (April 2026)** [T: Reddit, simplynode; docs say existing mobile zones phase out by Nov 16/30, 2026] | | | Don't plan on it |
| **NetNut** | **Seized by the FBI, July 2, 2026** [V: Krebs, Proxyway, seized.fyi] | | | Don't use |
| Newcomers claiming $0.8–1.5/GB (CellMast, HProxy, FlashProxy) | $0.80–1.50 | | | Vendor-published; unvetted. Candidates for a later bake-off, not for the pilot |

**ISP / static residential (per IP per month):**

| Provider | Shared | Dedicated | Notes |
|---|---|---|---|
| Webshare | **$0.30** (100 IPs); $0.27 at 1,000 | n/a | "Unlimited" bandwidth, fair use |
| Decodo | $0.47 (10 IPs); $0.35 (100) | $2.60 (100); $2.90 (10) | Also $2.00/GB pay-per-GB at 100 GB |
| Oxylabs | $1.40 (100) | $2.78 (100) | Unlimited fair use |
| Bright Data | $1.45 (100); $1.30 (1,000) | $2.75 (100) | Their recommended replacement for mobile |
| Proxy-Cheap / IPRoyal | – | $2.71 / $2.70 | |
| Rayobyte | – | $4.80 (100) | |

**Datacenter:** $0.50/GB at DataImpulse ($5 for 10 GB) [V]. Useless for YouTube; fine for geo-unblocking metadata and for sites that don't care.

**Browser-vendor bundles:** Browser Use charges $0.20/GB on top of your own proxy. Browserless and Steel charge $0 for your own proxy [T: proxylane.dev]. Meaning: bring your own proxy rather than paying $5–12/GB for bundled traffic.

### 2.6 How the big agent platforms do it (inference from published evidence)

| Platform | What it does | Source |
|---|---|---|
| **Manus** | **Cloud browser = datacenter IPs**, so "some websites may trigger additional verification". For security-sensitive or blocked sites, tells users to use **"My Browser"**: the agent drives the user's own local browser on their own home IP. Also a "Take Over" handoff for CAPTCHA, SMS and 2FA. | [V] manus.im/docs/features/cloud-browser |
| **OpenAI (ChatGPT cloud browser)** | Signs every request with **Web Bot Auth** (RFC 9421 HTTP Message Signatures). Cloudflare, Akamai, HUMAN and Vercel automatically verify it and let site operators allowlist "ChatGPT Agent". It doesn't hide; it identifies itself. | [V] help.openai.com/en/articles/11845367 |
| **Browser-infra vendors** (Browserbase, Steel, Browser Use, Anchor, Kernel, Bright Data Scraping Browser) | Resell residential proxy bandwidth at $5–12/GB, or bundle it. | [T] roost.guide (Nov 22, 2026) |
| **Grok Bot's own computer** | Exits through a Charter home connection (confirmed today: AS11427). This is the same "home IP" method as Manus' My Browser, just hosted. | Measured on the box |

**Takeaways:**
- The industry answer is not "buy a mobile proxy farm". It is a mix: (a) residential egress only for blocked destinations, (b) the customer's own device for sensitive flows, (c) signed-agent identity where sites cooperate, and (d) human handoff for verification.
- Amazon is actively litigating against agentic shopping (Amazon v. Perplexity/Comet). The Ninth Circuit **vacated** Amazon's preliminary injunction in Aug 2026, reasoning that on the existing record users, not Perplexity, access Amazon's servers. The case continues, and Amazon's amended complaint focuses on cookie copying and direct page requests. A district-court ruling on dismissal was still pending as of Nov 20, 2026 [T: Ninth Circuit opinion 26-1444, Courthouse News, Engadget].

---

## 3. DIY mobile modem farm vs buying

**Cost of a small farm (10 devices), two independent builds:**

| Item | iProxy.online guide (phones) | ProxyKite guide (Huawei E3372 dongles + Raspberry Pi) |
|---|---|---|
| Hardware one-time | About $460 (10 used Android phones at $40, SIMs, hubs, stands) | About $540 (10 dongles at $35, Pi 5, hub, PSU, cables) |
| SIM data per device per month | $15 (assumed "unlimited") | $10 (budget, not unlimited) |
| Management software per device per month | $6–9 | $9 |
| Power per device per month | $0.50 | $0.50 |
| Maintenance/replacements | $15/month for the farm | n/a |
| **Total monthly, 10 devices** | **About $230** | **About $195** |
| **Per device per month** | **About $23** | **About $19.50** |

Sources: [V] iproxy.online/blog/does-small-proxy-farms-profitable, [V] proxykite.com/blog/4g-proxy-farm-cost. Both are vendor sales material, and both assume cheap SIM data that I could not verify for the US.

**Why this is harder than it looks (and what kills the savings):**
1. **US carrier terms.** Consumer "unlimited" plans commonly prohibit commercial use, resale, server/host use, continuous automated connections and heavy tethering. Carriers can throttle, suspend or terminate [T: US Mobile and T-Mobile terms]. You'd need a business/IoT plan that expressly allows USB modems and third-party traffic, with written confirmation. Those cost more than $15 per line. Treat **$30–60 per line** as a realistic US budget [I].
2. **Throughput.** One modem is one IP and realistically tens of GB per month before deprioritization on a typical plan [I]. Real capacity per modem is far below "unlimited".
3. **Geography.** Each customer is pinned to a region. Modems must be physically in or near each target region (US East, Texas, West...), with cell coverage and someone to maintain them. The Helsinki server can't host US modems. A colo with cellular signal is hard, and that is why farms sit in offices and apartments.
4. **Concurrency.** Sticky sessions need one IP per concurrent customer session. 10K users may mean hundreds of simultaneous sessions, so hundreds of modems [I].
5. **Reputation and abuse.** Your SIMs inherit abuse from your customers' agents, and you handle complaints and KYC [T: proxykite legal guide].
6. **Labor.** SIM swaps, dead dongles, rotation scripts, monitoring.

**Break-even vs buying** (per modem, assuming $28 all-in per month including amortized hardware, and no labor):

| Compared with | $/GB | A modem pays for itself above... | 10 modems pay for themselves above... |
|---|---|---|---|
| DataImpulse mobile | $2.00 | 14 GB/month | 140 GB/month |
| Decodo mobile (100 GB tier) | $2.75 | 10 GB/month | 100 GB/month |
| IPRoyal/Oxylabs mobile | $5.00–5.20 | 5–6 GB/month | 55 GB/month |

Taking the throughput cap into account (assume 50–100 GB per modem per month), a 10-modem farm is worth **$1,000–2,000/month of $2/GB mobile traffic**, for about $280/month in costs plus labor. **DIY wins, on paper, once you consistently need above about 150–300 GB/month of mobile traffic in one region.** In practice that is around **1,000+ active users, or about 300 GB/month** (§6), and only if the carrier plan allows it.

**Recommendation:** buy now; revisit DIY when a single region exceeds about 500 GB/month of sticky-mobile traffic and a carrier has confirmed business terms in writing. Prefer **ISP/static IPs** for heavy, bandwidth-bound work first (§5). They're flat-rate and sit on datacenter hardware, so no SIM or modem is involved.

---

## 4. John's mobile point

**Is mobile worth the premium? As the default, no. As an escalation tier, yes.**

What John has right:
- A phone that toggles data gets a new IP, and carrier IPs are shared by many real users (CGNAT). Platforms are reluctant to ban them. This is real, and it is why mobile has the best reputation of any proxy type.
- A residential IP that jumps Virginia → Texas between requests looks odd. That is also real, and it is a pool-configuration problem, not a reason to pay double.

What the data says about the premium:
- On hard targets in 2026, mobile beat residential by under 1 point in median success (75.26% vs 74.43%), within the test's margin of noise [T: Proxyway PMR via TorchProxies]. Both degraded sharply year over year.
- Mobile is slower (3.67s vs 3.21s) and costs 1.1–2× more per GB. At DataImpulse it is $2 vs $1. At Decodo it is $2.75–4 vs $2.50–4.
- Mobile's own geography is shaky. City-level geolocation on carrier IPs is often wrong or drifts after a rotation, so "pin each customer to one region" is only reliably true at the country (and, in the US, metro-region) level [T: proxyudp].
- Rotation can also **hurt**: changing IP mid-login or mid-checkout prompts re-verification, on any proxy type [T: proxyudp, duallogin].

**Where to keep one sticky IP vs rotate:**

| Use | IP policy | Proxy type |
|---|---|---|
| Public viewing, research, search, reading a YouTube page or transcript | **Rotate between tasks** (new IP per task, never mid-page). Region pinned to the customer's country/state. | Rotating residential ($1/GB) |
| Downloading a video (yt-dlp) | **Sticky for the whole job** (manifest and download share an IP). New sticky session per job. Retry on a fresh session after a block. | Sticky residential; mobile if the residential IP is challenged |
| Signed-in Amazon / retail / travel / social | **One sticky IP per customer, region-pinned, persistent browser profile**, renewed in the same city/ASN when the session expires. Never use the same exit for two accounts. Best long-lived option: a dedicated ISP/static IP per customer account (about $2.6–2.7/month). | Sticky residential (24h+ sessions) → dedicated ISP IP for accounts that matter |
| Checkout/payment | Same sticky IP as the login. Prefer a human-in-the-loop step or the customer's own device (see §5). | Sticky residential, ISP, or customer-device egress |
| Escalation: residential keeps getting CAPTCHAs on a target | Retry once on a fresh residential session, then on **sticky mobile** for that destination | Mobile ($2/GB) |

**Rule: pin each customer to a single country + state/metro region, always.** The browser's timezone, locale and geolocation are derived from that pinned region (§1).

---

## 5. Recommended hybrid architecture

```
AgentLab browser / terminal / yt-dlp
        |
   [Egress gateway]  (small local forward proxy / PAC rules; one config, many upstreams)
        |  per-request: destination allowlist + task class + customer id
        |-- direct (Hetzner)            terminal, GitHub, APIs, package installs, most websites
        |-- residential, rotating       public reads of hard sites         (DataImpulse $1/GB)
        |-- residential, sticky         downloads, signed-in sessions      (DataImpulse / Decodo)
        |-- ISP / static IP             long-lived signed-in accounts; heavy downloads (flat per IP)
        |-- mobile, sticky              escalation after residential is challenged  ($2/GB)
        '-- customer-device egress      sensitive flows, when the customer opts in   ($0)
```

1. **Direct by default.** Never proxy the whole machine. Only traffic that hits the allowlist leaves via a proxy.
2. **Per-destination allowlist of hard sites.** Start with `youtube.com`, `googlevideo.com`, `ytimg.com`, `amazon.com`, big retail/travel/social domains, and add a domain only after seeing a block. The gateway can learn: on a captcha/403 from a direct request, retry once through the proxy and flag the domain for review.
3. **Sticky, per-customer, region-pinned sessions.** Session ID in the proxy username keyed by `customer_id + job_id` (for downloads) or `customer_id` (for signed-in accounts). Pin state/city so the IP, timezone, locale and geolocation always agree (§1).
4. **Credentials and payments policy.**
   - Passwords, payment cards and 2FA codes go only through (a) the customer's own device, (b) a KYC'd provider on a sticky ISP/static IP, or (c) a human-in-the-loop step ("Take Over", as Manus does). Never through free, unvetted or unclear-provenance pools.
   - HTTPS means the proxy can't read page content, but a pool built from other people's devices is a bigger trust surface than datacenter-hosted ISP IPs. That is exactly what the NetNut/IPIDEA takedowns show [V: Krebs, Google].
   - Never route one customer's session through another customer's IP or profile. Log which IP/provider each session used.
5. **Customer-device egress (free).** For customers who want it, offer a tiny tunnel or browser-extension mode where the agent's browser exits through the customer's own computer. This is Manus' "My Browser". It is zero marginal cost, has a perfect residential IP and geography, and is the best option for signed-in and financial sites. The catch: the customer's device must be on, and there is setup friction.
6. **Signed-agent identity.** Publish a Web Bot Auth key directory for AgentLab so sites that support it (via Cloudflare/Akamai/HUMAN/Vercel) can allowlist it. It costs nothing and, as sites adopt it, will cut proxy spend. OpenAI and Manus (published signature directory) both do this [V].
7. **Caching.**
   - Content-address downloaded media by video ID + format in Backblaze, so the same video is never downloaded twice across users.
   - Cache public pages and transcripts, never per-customer pages.
   - Cache the yt-dlp metadata JSON.
8. **Bandwidth saving on proxied page loads** (the biggest lever):
   - Block images, fonts, media, maps, ads and analytics at the browser. Measured: Amazon product page 7.96 MB → 3.44 MB (−57%) [T: everyinfra]; Hyatt search 4.0 → 1.1 MB (−72%) with a further drop to 178 KB for request-based [T: SOAX/Hyper].
   - Don't play video in the browser. Fetch transcripts, metadata or a **360p** download instead of watching.
   - Prefer HTTP-only fetches where the data is in the HTML (Amazon HTML only: 0.44 MB) [T: everyinfra].
   - Measure at the gateway. Chrome DevTools undercounts by about 25% versus what the proxy bills [T: SOAX].
9. **Bandwidth metering and per-plan caps.**
   - The gateway counts bytes per `customer_id`, `plan` and `destination`, billed separately from model tokens (as ChatGPT suggested).
   - Soft limit at 80%: tighten blocking, prefer cached data, drop to 360p. Hard limit at 100%: the agent pauses and asks the customer to buy a top-up pack instead of silently failing or silently overspending.
   - Suggested monthly proxied-traffic caps: **$20 plan 1 GB, $50 plan 4 GB, $100 plan 12 GB.** Top-up packs sold at cost plus margin.
   - Cross-check the provider's bill against gateway counts weekly.
10. **Heavy downloads on flat-rate IPs.** Downloads are about 43% of modeled traffic (§6). Test routing them through shared **ISP/static IPs** (Webshare $0.30/IP, Decodo $0.35/IP per month, "unlimited" bandwidth, fair use) instead of metered GB. A flagged IP stays flagged, but at $0.30–$1.40 per IP a rotation of dozens of IPs is cheap. **Unproven for YouTube; it's a pilot test (§7).**
11. **Provider abstraction.** The gateway holds provider credentials as upstream definitions, so DataImpulse can be swapped for Decodo (or another) without touching agent code. Hold at least two providers by the time volume exceeds about 1 TB/month, to survive pool takedowns (IPIDEA/NetNut precedent).
12. **Move compute later, not now.** The server is in Helsinki. Every US proxy hop adds latency, and the browser timezone must follow the exit IP anyway. If most customers are in the US, a US-region worker pool will cut round trips. This is optional and later.

---

## 6. Cost model

### 6.1 GB per task (through the proxy)

Browser traffic assumes images/fonts/media are blocked (§5.8). Numbers include an assumed 1.3× overhead for TLS handshakes, headers, retries and failed sessions (SOAX found proxies carry about 25% more than DevTools shows [T]).

| Task | Unblocked | With blocking (planning figure) | Basis |
|---|---|---|---|
| Typical content page load | 2–4 MB | **1.5 MB** | Hyatt 4.0 → 1.1 MB (−72%) [T: SOAX]; generic [I] |
| Amazon product page | 7.96 MB (4.15–13.6) | **3.4 MB** | [T: everyinfra]; HTML only 0.44 MB |
| **Amazon order flow** (sign-in, search, 3 product pages, cart, checkout steps ≈ 12 loads) | about 95 MB | **about 40 MB (0.04 GB)** | 12 pages × 3.4 MB [I] |
| YouTube video "read" (metadata + transcript via yt-dlp `--skip-download`) | about 1 MB | **about 1–3 MB (0.003 GB)** | Rough network-counter measurement on the box: about 1.0 MB. Noisy; verify in the pilot [I] |
| "Watch" a 10-minute video at 360p | – | **about 30 MB (0.03 GB)** | Measured sizes: 360p AVC 17.5 MiB + audio 9.8 MiB for a 10.6-min video (yt-dlp format list on the box) |
| **Download a 10-min 720p video** | 70–155 MB | **about 100 MB (0.10 GB)** | Measured on one 10.6-min 720p60 video: AV1 68 MiB, VP9 107 MiB, AVC 144 MiB, each plus about 10 MiB audio. 720p30 talking-head video runs lower |

### 6.2 Monthly proxied traffic per plan (the model's assumptions)

| Plan | Page loads | Amazon flows | YT reads | YT 360p watches | 720p downloads | **GB/month, with 1.3× overhead** |
|---|---|---|---|---|---|---|
| $20 Light | 150 | 2 | 10 | 2 | 3 | **0.90** |
| $50 Standard | 600 | 8 | 40 | 8 | 12 | **3.6** |
| $100 Pro | 2,000 | 25 | 150 | 25 | 40 | **12.0** |

Plan mix assumed: 60% / 30% / 10%. Blended revenue is $37 per user per month. Blended proxied traffic is **2.8 GB per user per month if every user touches proxied sites**. Half of that if only 50% do. These are my assumptions, not measured usage, and **the pilot should replace them with real numbers**.

### 6.3 Monthly proxy cost per user per plan

| Plan | Option B hybrid (70% DI residential $1 + 30% DI mobile $2 = **$1.30/GB**) | All DataImpulse mobile ($2/GB) | Decodo residential ($2.75/GB) | Browser-vendor bundled ($5/GB) |
|---|---|---|---|---|
| $20 Light | **$1.17 (5.9% of price)** | $1.81 | $2.48 | $4.52 |
| $50 Standard | **$4.70 (9.4%)** | $7.23 | $9.94 | $18.07 |
| $100 Pro | **$15.55 (15.5%)** | $23.92 | $32.89 | $59.80 |

At the caps in §5.9 (1 / 4 / 12 GB) the worst-case cost at $1.30/GB is $1.30, $5.20 and $15.60. Pro is the tightest plan, so it needs the biggest levers (360p downloads, caching, ISP flat-rate IPs for downloads).

### 6.4 Total monthly cost at 100 / 1K / 10K users

Volume prices: DataImpulse residential $1.00 → $0.80 (≥1 TB tier, published) → **about $0.65 assumed** at 28 TB with a custom quote. DataImpulse mobile $2.00 → $1.60 (published) → **about $1.30 assumed** with a custom quote. The 10K-user prices are my assumption, since custom pricing is not published. Decodo uses published tiers, $2.50 at 250 GB and $2.00 at 1 TB.

**If every user uses proxied sites at the modeled rate (conservative upper bound):** 282 GB / 2.8 TB / 28 TB per month.

| Option | 100 users | 1,000 users | 10,000 users |
|---|---|---|---|
| A. DataImpulse residential only | $282 ($2.82/user) | $2,258 ($2.26) | $18,345 ($1.83) |
| **B. Hybrid 70% residential / 30% mobile (recommended)** | **$367 ($3.67)** | **$2,935 ($2.94)** | **$23,990 ($2.40)** |
| C. All DataImpulse mobile | $564 ($5.64) | $4,516 ($4.52) | $36,690 ($3.67) |
| D. Decodo residential | $705 ($7.05) | $5,645 ($5.64) | $56,446 ($5.64) |
| E. Browser-vendor bundled ($5/GB) | $1,411 ($14.11) | $14,112 ($14.11) | $141,115 ($14.11) |

**If only 50% of users touch proxied sites in a month (more likely):**

| Option | 100 users | 1,000 users | 10,000 users |
|---|---|---|---|
| A. DataImpulse residential only | $141 | $1,129 | $9,172 |
| **B. Hybrid (recommended)** | **$183 ($1.83/user)** | **$1,468 ($1.47)** | **$11,995 ($1.20)** |
| C. All DataImpulse mobile | $282 | $2,258 | $18,345 |
| D. Decodo residential | $353 | $2,822 | $28,223 |

**Takeaways:**
- The cheapest viable option (B) costs about **$1.2–3.7 per user per month**, which is **3–10% of the $37 blended revenue per user**.
- **All-mobile (C) costs 54% more than the hybrid**, and the data doesn't show a big enough success gain to justify it as the default.
- **Bundled browser-vendor proxy traffic (E) would eat 38% of blended revenue** (about $14/user). Bring your own proxy.
- **Big levers not already in the model:** 360p instead of 720p for analysis (about −25% of total GB), cross-user media caching, and flat-rate ISP IPs for downloads (could remove about 40% of metered GB). Customer-device egress and signed-agent identity remove traffic entirely.
- **Risk to the model:** the Pro plan's 15.5% cost is the one that could bite. Cap it and sell top-ups.
- Fixed costs: DataImpulse has **no monthly minimum**. Decodo's lower tiers need a monthly plan ($275 for 100 GB). The gateway's engineering and hosting costs are not included.

---

## 7. ToS / legal risks, and the cheapest pilot

### 7.1 Risks, in brief (not legal advice)

| Area | Risk | Mitigation |
|---|---|---|
| **YouTube ToS** | Prohibits accessing the service "using any automated means (such as robots, botnets or scrapers)" without YouTube's prior written permission, and prohibits circumventing security features [V: youtube.com/t/terms]. Downloading without a download link or permission is also barred, and YouTube's developer policies restrict downloading audiovisual content. | Prefer approved sources (customer uploads, licensed/CC footage, Internet Archive). Use the official YouTube Data API for metadata where it covers the need. Treat YouTube downloads as a business risk John has to accept knowingly, and gate them behind a permission and user attribution. |
| **Amazon** | Conditions of Use bar robots and scrapers (I could not read the page directly today; widely reported). Amazon sues agentic shopping tools. The Perplexity/Comet injunction was vacated by the Ninth Circuit in Aug 2026, but the case continues [T]. | Act for a customer in the customer's own authorized session, with the customer approving purchases. Keep the "user is the actor" posture. Avoid copying cookies from other devices (a point in Amazon's amended complaint). |
| **Proxy provenance** | Some residential pools were built from SDKs bundled in apps without meaningful consent. **NetNut** (the "Popa" botnet) was seized July 2, 2026, and **IPIDEA** was disrupted by Google in Jan 2026 (and rebuilt to about 112% of its size within six months, per Lumen) [V: Krebs, Google Cloud blog, Proxyway; T: HardenStance]. Google warns that these pools get resold and white-labeled. | Choose providers that publish sourcing and KYC policy. Keep two vendors behind the gateway. Don't route credentials or payments through opaque pools. Record which provider handled each session. |
| **Provider terms / KYC** | Bright Data now requires company KYC for residential, and bans account management on social platforms [T: Reddit, docs]. Other providers' AUPs bar illegal use and login-protected scraping without permission [V: iproyal FAQ]. | Transovo AI as a registered company can pass KYC if needed. Read each AUP before purchase. Don't use proxies to evade bans on accounts that were already restricted. |
| **Customer credentials** | Customers' bank/shop credentials pass through the browser. | Policy in §5.4. Human-in-the-loop for payment, 2FA and CAPTCHA. |
| **CFAA / unauthorized access** | Using proxies to get around an explicit block on an account or IP can look like circumventing access controls. | Don't try to defeat targeted blocks on specific customers' accounts. Back off when a site asks to stop. |
| **DIY farm** | Carrier terms, SIM KYC, abuse complaints land on you [T: proxykite]. | Don't do DIY yet (§3). |

### 7.2 Recommended cheapest pilot (needs John's approval; nothing has been bought)

**Goal:** prove which route clears YouTube and Amazon from the AgentLab browser for the lowest GB cost, and replace the guesses in §6.

**Budget: about $136, capped at $150, over 2 weeks.** Pay by company card, one account per provider, no auto-renew.

| Item | Cost | Purpose |
|---|---|---|
| **DataImpulse residential**: $5 Intro (5 GB) + $50 top-up (50 GB) = 55 GB at $1/GB | $55 | Main candidate: rotating and sticky, region-pinned |
| **DataImpulse mobile**: $5 Intro (2.5 GB) + $50 top-up (25 GB) = 27.5 GB at $2/GB | $55 | Escalation tier test |
| **Decodo residential pay-go**, 5 GB at $4/GB | $20 | Cross-check: top YouTube infra success in Proxyway's table, with 24-hour sticky sessions |
| **Webshare shared ISP**, 20 IPs | $6 | Test flat-rate IPs for downloads and signed-in sessions |
| **Total** | **$136** | |

**Pilot tests** (read-only or throwaway; no customer accounts, no real purchases):
1. **YouTube:** yt-dlp `-4 --skip-download` then a full 360p download, through each route, 30 videos per route, sticky session per job. Record success rate, errors, GB and repeat-block behavior after a few hours.
2. **YouTube in the browser:** headed Chrome, timezone/locale/geo matched to the exit IP, persistent profile. Does the sign-in wall disappear? Record the result in a screenshot.
3. **Amazon:** search plus 20 product-page loads with images/media blocked, 3 routes. Count CAPTCHA/robot-check pages. Measure GB per page at the gateway. A sign-in test is run only on a throwaway test account John explicitly approves, with no purchase.
4. **Geo consistency:** run an IP-geolocation check on 20 exits per route. Does the city/state stay stable within a sticky session? Do timezone and locale agree?
5. **Egress gateway prototype:** a local forward proxy with a destination allowlist, per-session byte counter, and region pinning. Verify no DNS or WebRTC leaks.
6. **Measurement:** replace every guess in §6.1 with real GB per task.

**Success criteria for the pilot:**
- At least 90% yt-dlp success per sticky job on the cheapest route that passes.
- At least 80% non-robot-check Amazon page loads in the browser.
- Measured GB per task within about 1.5× the model.
- Mobile only earns a permanent place if it beats sticky residential by 10+ points on at least one target.

**Decision after the pilot:**
- If DataImpulse residential passes, run the hybrid at $1/GB and keep mobile for escalation only.
- If it fails, fall to Decodo ($2.75/GB at 100 GB) or mobile.
- If flat-rate ISP IPs pass YouTube downloads, put downloads on ISP IPs. That removes about 40% of metered GB.

Do **not** buy a proxy farm, a Bright Data contract, or anything enterprise until the pilot data is in.

---

## Sources

**Detection:**
- https://blog.cloudflare.com/ja4-signals/ [V]
- https://developers.cloudflare.com/bots/additional-configurations/ja3-ja4-fingerprint/ [V]
- https://blog.crawlex.net/blog/server-side-vs-client-side-bot-detection/ [T]
- https://cdpfleet.com/docs/fingerprinting [T]
- https://browserscan.in/bot-detection [T]
- https://docs.apostate.dev/concepts/detection [T]

**Block rates and benchmarks:**
- https://aimultiple.com/us-proxies (updated Nov 12, 2026) [T]
- https://floppydata.com/residential-proxy-benchmark/ (Oct 5–8, 2026; vendor-run) [T]
- https://proxyway.com/best/youtube-proxies (May 2026 data, updated Nov 16, 2026) [T]
- https://torchproxies.com/blog/do-mobile-proxies-work-better-than-residential-what-the-data-says-torchproxies/ (summarizes Proxyway PMR 2026) [T]
- https://proxyudp.com/en/learning-hub/mobile-proxy-cgnat-ip-pools-geolocation/ [T]
- https://github.com/yt-dlp/yt-dlp/issues/16870 [V]
- https://hproxy.com/blog/proxies-for-yt-dlp (vendor) [T]
- https://tunelio.dev/blog/yt-dlp-proxy/ [T]
- https://ytdlp.org/guides/yt-dlp-proxy [T]
- https://globalcorpora.com/blog/yt-dlp-proxy-guide/ [T]

**Pricing:**
- https://dataimpulse.com/mobile-proxies/ and https://help.dataimpulse.com/en/articles/15930995-minimum-payment-and-plan-sizes-explained [V]
- https://decodo.com/proxies/residential-proxies/pricing [V]
- https://help.decodo.com/docs/residential-proxy-custom-sticky-sessions [V]
- https://brightdata.com/pricing/proxy-network/mobile-proxies (shows the general proxy price page; mobile pages removed) [V]
- https://docs.brightdata.com/products/residential/network-access and https://docs.brightdata.com/release-notes [V]
- https://iproyal.com/mobile-proxies/ [V]
- https://oxylabs.io/products/mobile-proxies/pricing [V]
- https://scrapemeter.com/mobile-proxy-pricing and https://scrapemeter.com/isp-proxy-pricing (Oct 6, 2026) [T]
- https://cellmast.com/data/mobile-proxy-price-index-2026/ (Oct 13, 2026; vendor) [T]
- https://hproxy.com/blog/best-mobile-proxies (Oct 26, 2026; vendor) [T]
- https://proxytable.com/mobile-proxies/ [T]
- https://www.simplynode.io/post/bright-data-closed-mobile-proxies-to-new-customers [T]
- https://www.reddit.com/r/proxies/comments/1sm7uyn/brightdata_is_sunsetting_mobile_proxies/ [T]

**Bandwidth:**
- https://everyinfra.com/en/blog/proxy-traffic-cost-amazon-product-pages [T]
- https://soax.com/blog/residential-proxy-bandwidth-browser-vs-request-based [T, vendor]
- https://proxylane.dev/blog/browser-agent-proxy-cost [T, vendor]
- https://roost.guide/questions/browser-sandbox-residential-proxy/ [T]

**DIY and carrier terms:**
- https://iproxy.online/blog/does-small-proxy-farms-profitable/ [T, vendor]
- https://proxykite.com/blog/4g-proxy-farm-cost/ and https://proxykite.com/blog/is-mobile-proxy-farm-legal/ [T, vendor]
- https://www.usmobile.com/terms/2026-02-17 and https://www.t-mobile.com/responsibility/legal/terms-and-conditions [V]

**How platforms do it:**
- https://www.manus.im/docs/features/cloud-browser [V]
- https://help.openai.com/en/articles/11845367-chatgpt-works-cloud-browser-allowlisting [V]

**Takedowns and legal:**
- https://krebsonsecurity.com/2026/07/fbi-seizes-netnut-proxy-platform-popa-botnet/ [V]
- https://proxyway.com/news/fbi-google-disrupt-netnut [T]
- https://seized.fyi/netnut-%2F-divinetworks [T]
- https://cloud.google.com/blog/topics/threat-intelligence/disrupting-largest-residential-proxy-network (IPIDEA) [V]
- https://www.hardenstance.com/lumen-shows-ipidea-grew-bigger-within-months-of-takedown/ [T]
- https://www.youtube.com/t/terms [V, read directly today]
- https://cdn.ca9.uscourts.gov/datastore/opinions/2026/08/04/26-1444.pdf (Amazon v. Perplexity, 9th Cir.) [V per search summary; not read in full]
- https://www.courthousenews.com/back-in-lower-court-amazon-wants-to-continue-suit-against-ai-assistant/ [T]

## What I could not verify
- Proxyway's PMR 2026 report itself (cited secondhand via TorchProxies).
- Any YouTube-specific block rate split by proxy type.
- Amazon's Conditions of Use text (their page returned nothing to a plain fetch today).
- DataImpulse sourcing and quality at the 10K-user scale, and custom volume pricing above 1 TB.
- Whether flat-rate ISP IPs hold up against YouTube downloads (pilot test 1).
- US carrier business/IoT plan prices for a DIY farm (budgeted at $30–60 per line as an estimate).
- The ~1 MB YouTube metadata figure came from a noisy network-counter reading on the box.

---

## Live test Nov 24 (DataImpulse residential, 5 GB, $1/GB)

Test only. No AgentLab config, code, container or service was changed. A throwaway venv and a local byte-counting forwarder lived in `/root/tmp-proxy-test` on the AgentLab server and were deleted afterwards. Per-run byte counts: `proxy-live-test-nov24/bytes-per-run.txt`. No credentials appear in this section.

### Setup facts
- **Syntax** (user redacted): `http://<LOGIN>__cr.us;sessid.<N>:<PASS>@gw.dataimpulse.com:823`. `__cr.us` pins the country. `sessid.<N>` is a ~30-minute sticky IP on the normal port. Port 10000 is the "sticky" port, and there `sessttl.<minutes>` sets the interval. SOCKS5 is port 824. Country-only is rotating per request.
- DataImpulse bills double for state, city, ZIP, ASN and geohash targeting. Country alone is the base $1/GB.
- **Gotcha on my box only:** the sandbox DNS answers `gw.dataimpulse.com` with a fake address, so the proxy returned 403 until I used the IP `74.81.81.81`. The Hetzner server resolves the hostname fine.
- Exit IPs came back as US residential ISPs (for example RCN). Not every IP is clean.

### YouTube, same video set, from the Hetzner IP
| Variant | Result | Proxy MB |
|---|---|---|
| a. Baseline direct | **Blocked** ("Sign in to confirm you're not a bot") on 7 of 8 videos tried. Only very popular videos sometimes extract directly. | 0 |
| b. Full proxy (extract + download) | **Works.** 64 s video, 240p+audio: 2.2 MB. 50 s video, 360p+audio: 3.2 MB. | see tiers below |
| c. Unlock-only (extract via proxy, download direct) | **Fails.** The googlevideo URLs carry `ip=<proxy exit IP>`. Direct fetch of the same URL gives **HTTP 403** (curl and yt-dlp). So the media bytes must also go through the same sticky IP. | extract 1.4 MB, then 403 |
| d. Cheaper variants | Subtitles and 240p video-only (tiers below). `player_client=android_vr` with `player_skip=webpage` is blocked on every IP (5 of 5), so it is no shortcut. | 0.05 per failed try |

**Cheap-trick verdict:** the "proxy only the unlock step" idea does not work for YouTube. The fix is sticky-IP full proxy, but with the smallest media that does the job (tiers below).

### Reliability
- With default yt-dlp clients, about 70% of fresh sticky sessions worked first try (about 15 of 21 extractions). A blocked try costs only 0.16–0.75 MB, and a new `sessid` usually works. One session got a 429 from youtube.com.
- So the wrapper must **retry with a new sessid, up to 4–5 times**. Expected extra cost is about 0.3 MB per video.

### Hidden finding: yt-dlp in the AgentLab container is stale
The container runs yt-dlp 2026.10.26 with yt-dlp-ejs 0.8.0. Against YouTube's current player (`b485e332`), the n-challenge solver **fails with both node 22 and deno 2.9.8** ("n challenge solving failed: Some formats may be missing"). Result: it silently falls back to low-quality formats (240p). yt-dlp **2026.11.23** solves it cleanly (and uses the `tv` player). The upgrade should go in the AgentLab image or its pip layer. I did not touch it.

### Fixed overhead per extraction
About **0.8–0.9 MB**: the watch page (~0.15 MB) plus the player JS (~0.7 MB), which is re-downloaded every run and not cached across runs. Media is on top of that. Without a JS runtime the overhead is 0.4 MB, but then formats are missing.

### Tiered policy (John's rule: use the smallest media that does the job)
| Tier | When | How | Measured proxy cost |
|---|---|---|---|
| **1. Understand / check a video** | Summarize, fact-check, quote | Transcript only. `youtube-transcript-api` through the proxy: **0.38 MB**, first try, 20 snippets. `yt-dlp --write-auto-subs --skip-download`: 0.88 MB (the player JS is the cost). | **$0.0004–0.0009** |
| **2. Bot must see frames** | Visual check, scene review | **240p video-only** (`-f "bv*[height<=240]"`; add 144p or 360p if 240p is missing). Test: 3m33s video at 240p AV1 = 3.1 MB, which is **0.87 MB per minute**, plus 0.8 MB fixed. Total 3.9 MB for the whole video. Audio-only (m4a, 50 s) = 1.2 MB total. For comparison, the same video at 1440p is about 144 MiB (about 40 MB per min). | **$0.004 per 3.5 min video** |
| **3. Clip goes into an edit** | Final media | Full quality. 360p+audio of a 50 s clip: 3.2 MB. Larger heights scale roughly 2–4× per step. Download only the needed section (`--download-sections`). Cache by video ID and format in Backblaze. | $0.003 and up, depending on height |

Transcripts without the proxy: **fail.** `youtube-transcript-api` direct from the Hetzner IP raises `IpBlocked`, and yt-dlp subtitles direct hit the same bot wall. So even tier 1 needs the proxy from this server.

### Amazon (curl with a Chrome UA, no browser)
- Direct from Hetzner: 4 of 5 tries got a captcha or 503 (1–4 KB). One try got the real product page (143 KB).
- Through the proxy (rotating and sticky): about 1 in 4 got the real page (147 KB to 540 KB). The rest got the captcha page (1–4 KB, so a failed try is cheap).
- **Inconclusive for curl.** The residential IP does not fix Amazon by itself with plain HTTP. It needs a real browser fingerprint (headed Chrome with matching timezone, geolocation, persistent profile) on top of the IP. Still, a real product page costs 0.15–0.55 MB with HTML only, and about 3.4 MB in a full browser with images blocked.

### Total traffic used by this test
About **31 MB**: 28.8 MB counted by the forwarder (30 runs, 82 connections) plus about 2 MB of Amazon and ipinfo/ipify curls. That's about **$0.03**, or **0.6%** of the 5 GB. Cross-check it against the DataImpulse dashboard.

### Recommended allowlist-only wiring plan (NOT implemented)
1. **Local egress gateway.** A small forward proxy like the test forwarder (about 60 lines; Python or Go) on `127.0.0.1:18080` in the AgentLab container or host, under a systemd unit. It takes the upstream credentials from `/opt/agent/secrets`, which means the secret never reaches the agent shell. It must:
   - add the DataImpulse Basic auth (Chrome cannot take user:pass in `--proxy-server`);
   - apply `__cr.us;sessid.<hash(job_id)>` per job, with the session ID chosen by a header or a port per job;
   - count bytes per job and host into a log (this is the per-user cost meter);
   - **use the allowlist as the only way in:** hosts not on the list return a clear "not on proxy list" error or go direct.
2. **Allowlist (v1):** `youtube.com`, `*.youtube.com`, `googlevideo.com`, `ytimg.com`, `youtu.be`, `google.com` (consent redirects), `amazon.com` (browser only). Add a domain only after a captcha/403 is seen on a direct request.
3. **yt-dlp:** put a wrapper at `/opt/tools/ytdl`, with the agent told to use it. The wrapper runs yt-dlp **2026.11.23 or newer** with `--proxy http://127.0.0.1:18080`, retries 4–5 times with new session IDs on "Sign in to confirm", and defaults by tier (`transcript` / `frames` = 240p video-only / `full`). Alternatively set it in the container's `~/.config/yt-dlp/config`, but a wrapper can retry. Also upgrade yt-dlp and yt-dlp-ejs in the container image.
4. **Transcript tool:** add `youtube-transcript-api` with `GenericProxyConfig` pointed at the gateway as the tier 1 default, ahead of any video download.
5. **Browser:** in `/opt/tools/chrome-keeper`, launch Chromium with `--proxy-server=http://127.0.0.1:18080` and `--proxy-bypass-list` for everything not in the allowlist (or a PAC file). Set timezone and geolocation to the US exit region, and block images and media on proxied hosts (about −57% bytes).
6. **Python tools in `runner/agentd.py`** (the HTTP section, around line 1342) get the same gateway through `HTTPS_PROXY` only for allowlisted hosts, via the gateway's own host filter. The runner itself stays direct.
7. **Caps and logging:** per-job byte cap in the gateway (for example 25 MB default and 150 MB with approval), and a daily total with alerts at 80%. Cache transcripts and media by video ID.
8. **Rollout order:** (a) upgrade yt-dlp and deploy the gateway; (b) the YouTube wrapper and transcript tool; (c) browser allowlist; (d) metering UI. Keep a second provider in mind as volume grows.
