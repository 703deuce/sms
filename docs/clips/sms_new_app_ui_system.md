# Transovo `new-app` UI System — build spec for the clipping product

> **Audience:** a coding agent building Opus Clip–style pages (upload → AI clips → edit → export) inside the existing app.
> **Rule #1:** use the components, tokens and conventions below. Do not introduce a new design language, a new component library, Radix, or a new data-fetching library.
> **Source:** GitHub `703deuce/sms`, default branch **`master`**, folder **`new-app/`** (all paths below are relative to `new-app/` unless they start with `/`). Catalogued read-only on 2026-10-25.

## 0. Orientation (read first)

- The repo holds two apps. The **legacy app** lives at the repo root (`/src/app`, ~1,400 files, root `package.json`). **Ignore it.** The rebuilt app is **`new-app/`** (package name `transovo-new-app`, brand "Transovo"). Per `new-app/README.md` it is isolated: **never import from `../../src`**.
- Other root folders you can ignore: `transovo-ui-blueprint/` (the seed design blueprint new-app grew from, same `app/app/*` layout), `newui/`, `newui2/`, `ui-rebuild/` (earlier UI experiments), `supabase/` (SQL scripts), `voice-runtime*`. `/prisma/schema.prisma` at repo root **is used** by new-app (see §1).
- `new-app/AGENTS.md` warns: *"This is NOT the Next.js you know"*. Next 16 has breaking changes, so read `node_modules/next/dist/docs/` before using unfamiliar Next APIs. Example: `searchParams` is a `Promise` in pages (see `app/app/phone/calls/page.tsx`).
- Folder naming gotcha: `new-app/app/app/*` = the **`/app` URL segment** (authenticated shell) inside the Next `app/` router dir. `new-app/app/page.tsx` (`/`) and `new-app/app/app/page.tsx` (`/app`) both just `redirect('/app/home')`.

---

## 1. Stack

**One line:** Next.js 16.4 App Router + React 19 + TypeScript 5.7, Tailwind CSS v4 (CSS-first, no config file), shadcn/ui v4 "base-nova" style on **@base-ui/react** (not Radix), lucide-react icons, sonner toasts, recharts charts, Prisma 6 on Postgres, Stripe SDK, pnpm. Dev port 3100. Coolify deploy, `output: 'standalone'`.

| Concern | What's used | Where |
|---|---|---|
| Framework | `next` 16.4.0 (App Router, RSC, Turbopack), `react` 19 | `package.json`, `next.config.mjs` |
| Language | TypeScript 5.7.3 (`typescript.ignoreBuildErrors: true` in next.config, but keep code typed) | `tsconfig.json` |
| Styling | Tailwind v4 via `@tailwindcss/postcss`; `tw-animate-css`; `shadcn/tailwind.css`. **No `tailwind.config.*`.** All tokens live in `app/globals.css` | `app/globals.css`, `postcss.config.mjs` |
| Components | shadcn v4, `style: "base-nova"`, `baseColor: neutral`, `cssVariables: true`, built on `@base-ui/react` | `components.json`, `components/ui/*` |
| Variants | `class-variance-authority`, `clsx` + `tailwind-merge` → `cn()` | `lib/utils.ts` |
| Icons | `lucide-react` ^1.16 | everywhere |
| Toasts | `sonner` (`<Toaster position="bottom-right"/>` mounted in root layout) | `components/ui/sonner.tsx`, `app/layout.tsx` |
| Charts | `recharts` 3.8 via shadcn `ChartContainer` | `components/ui/chart.tsx`, `components/app/charts.tsx` |
| Fonts | `Geist` + `Geist_Mono` via `next/font/google` | `app/layout.tsx` |
| Theme | **Light only.** `next-themes` is installed but there is no `.dark` token block; `colorScheme: 'light'`, `themeColor: '#f8f9fb'` | `app/layout.tsx`, `app/globals.css` |
| Validation | `zod` | API routes |
| DB | Prisma 6.16 (`@prisma/client`). The canonical schema is at **repo root** `/prisma/schema.prisma` (`prisma generate --schema=../prisma/schema.prisma`). The client is `getPrisma()` | `lib/server/db.ts` |
| Payments | `stripe` ^22. `getStripe()` returns `null` when `STRIPE_SECRET_KEY` is unset (mock mode) | `lib/stripe/client.ts` |
| Credits/entitlements | Stubs only: `checkCreditBalance()` → `{ok:true}`, `isWorkspaceCreditEnforced()` → false, `deductCreditsForSend()` no-op | `lib/billing/entitlements.ts`, `lib/settings/billing.ts` |
| Auth | **None yet.** `lib/api-auth.ts#requireSession()` returns a dev session (`DEV_AUTH_USER_ID`/`DEV_AUTH_EMAIL`). `lib/server/workspace.ts#resolveWorkspaceId()` pins the workspace via `DEV_WORKSPACE_ID`/`TRANSOVO_WORKSPACE_ID`/`WORKSPACE_ID` or bootstraps the first row. No middleware/proxy, no login pages | `lib/api-auth.ts`, `lib/server/workspace.ts` |
| Data fetching | **No SWR / React Query.** Plain `fetch` wrappers in `lib/*-api.ts` plus `useEffect`/`useState` in client components and React context providers | `lib/receptionist-api.ts`, `lib/phone-api.ts` |
| Mock data | `lib/data.ts` (BUSINESS, TEAM, CALLS, …) still powers parts of the UI (header user "Maya Okafor", home page) | `lib/data.ts`, `lib/metrics.ts` |
| Other deps (domain-specific, not needed for clipping) | `livekit-client`/`livekit-server-sdk`, `@telnyx/webrtc`, `openai` ^4, `@vercel/analytics`, `playwright` (dev) | |
| Scripts | `dev: next dev --port 3100`, `build: prisma generate && next build`, `start: node scripts/start-production.mjs`, `typecheck: bash scripts/typecheck-from-git.sh` | `package.json` |
| Deploy | Coolify, base dir `new-app`; `output: "standalone"`, `images.unoptimized: true`, `serverExternalPackages: [@prisma/client, prisma, livekit-server-sdk]` | `next.config.mjs`, `docs/COOLIFY-NEW-APP-WEB.md` |

**Implications for clipping work:** `next/image` is unoptimized, so plain `<img>`/`<video>` is fine for thumbnails. Large video uploads must **not** use the knowledge-upload pattern (base64 in a DB row, 25 MB cap). Use direct-to-object-storage uploads (see §7).

---

## 2. Design tokens (quoted exactly from `app/globals.css`)

Visual language: *"porcelain neutrals, deep sapphire primary, emerald + amber signal accents"*. It is a light, airy surface style. Cards are white with a hairline ring plus a soft shadow (`.surface`) instead of borders. The primary color is a glossy sapphire gradient (`.tile-primary`, default `Button`). Radius base is 0.75rem. Type is Geist with tight tracking on headings.

### 2.1 Full file (verbatim)

```css

@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Geist', 'Geist Fallback', ui-sans-serif, system-ui;
  --font-mono: 'Geist Mono', 'Geist Mono Fallback', ui-monospace;

  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);

  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-muted: var(--sidebar-muted);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* Palette: porcelain neutrals, deep sapphire primary, emerald + amber signal accents. Light, layered surfaces. */
:root {
  color-scheme: light;
  --background: oklch(0.982 0.003 255);
  --foreground: oklch(0.21 0.022 264);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.022 264);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.022 264);
  --primary: oklch(0.47 0.17 263);
  --primary-foreground: oklch(0.99 0.003 255);
  --secondary: oklch(0.962 0.005 255);
  --secondary-foreground: oklch(0.3 0.025 264);
  --muted: oklch(0.966 0.004 255);
  --muted-foreground: oklch(0.52 0.018 262);
  --accent: oklch(0.955 0.022 263);
  --accent-foreground: oklch(0.38 0.15 263);
  --destructive: oklch(0.58 0.2 22);
  --success: oklch(0.58 0.13 160);
  --success-foreground: oklch(0.99 0.003 255);
  --warning: oklch(0.78 0.14 75);
  --warning-foreground: oklch(0.45 0.1 60);
  --info: oklch(0.47 0.17 263);
  --border: oklch(0.925 0.006 258);
  --input: oklch(0.9 0.008 258);
  --ring: oklch(0.47 0.17 263 / 0.5);
  --chart-1: oklch(0.47 0.17 263);
  --chart-2: oklch(0.74 0.09 245);
  --chart-3: oklch(0.78 0.14 75);
  --chart-4: oklch(0.58 0.13 160);
  --chart-5: oklch(0.72 0.015 260);
  --radius: 0.75rem;

  --sidebar: oklch(0.97 0.004 258);
  --sidebar-foreground: oklch(0.38 0.02 264);
  --sidebar-muted: oklch(0.56 0.016 262);
  --sidebar-primary: oklch(0.47 0.17 263);
  --sidebar-primary-foreground: oklch(0.99 0.003 255);
  --sidebar-accent: oklch(1 0 0);
  --sidebar-accent-foreground: oklch(0.21 0.022 264);
  --sidebar-border: oklch(0.92 0.006 258);
  --sidebar-ring: oklch(0.47 0.17 263 / 0.5);

  --shadow-color: 264 30% 20%;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
}

@layer base {
  h1, h2, h3 {
    letter-spacing: -0.015em;
  }
}

@layer utilities {
  .tabular {
    font-variant-numeric: tabular-nums;
  }

  /* Layered card: hairline ring + two-step soft shadow. */
  .surface {
    background-color: var(--card);
    box-shadow:
      0 0 0 1px oklch(0.21 0.022 264 / 0.06),
      0 1px 2px -1px hsl(var(--shadow-color) / 0.08),
      0 2px 6px -2px hsl(var(--shadow-color) / 0.06);
  }

  .surface-raised {
    background-color: var(--card);
    box-shadow:
      0 0 0 1px oklch(0.21 0.022 264 / 0.06),
      0 2px 4px -2px hsl(var(--shadow-color) / 0.1),
      0 10px 24px -8px hsl(var(--shadow-color) / 0.12);
  }

  /* Glossy primary tile used for active nav, brand mark, and featured icons. */
  .tile-primary {
    background-image: linear-gradient(180deg, oklch(0.56 0.17 263), oklch(0.44 0.17 264));
    color: var(--primary-foreground);
    box-shadow:
      inset 0 1px 0 oklch(1 0 0 / 0.22),
      0 0 0 1px oklch(0.38 0.15 264),
      0 4px 10px -3px oklch(0.47 0.17 263 / 0.45);
  }

  .bg-grid-fade {
    background-image:
      radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.955 0.022 263 / 0.9), transparent 70%);
  }
}

```

### 2.2 Token cheat-sheet (use the Tailwind utility, never raw oklch)

| Purpose | Utility | Value |
|---|---|---|
| App background | `bg-background` | `oklch(0.982 0.003 255)` |
| Body text | `text-foreground` | `oklch(0.21 0.022 264)` |
| Card / popover | `bg-card`, `bg-popover` | `oklch(1 0 0)` |
| Primary (sapphire) | `bg-primary`, `text-primary`, `ring-primary` | `oklch(0.47 0.17 263)` |
| Secondary text | `text-muted-foreground` | `oklch(0.52 0.018 262)` |
| Soft fill | `bg-muted`, `bg-secondary` | `oklch(0.966 …)`, `oklch(0.962 …)` |
| Selected / info tint | `bg-accent text-accent-foreground` | `oklch(0.955 0.022 263)` / `oklch(0.38 0.15 263)` |
| Success (emerald) | `text-success`, `bg-success/10` | `oklch(0.58 0.13 160)` |
| Warning (amber) | `bg-warning/15 text-warning-foreground` | `oklch(0.78 0.14 75)` / `oklch(0.45 0.1 60)` |
| Danger | `text-destructive`, `bg-destructive/8` | `oklch(0.58 0.2 22)` |
| Hairlines | `border-border`, `border-input` | `oklch(0.925 …)`, `oklch(0.9 …)` |
| Focus | `ring-ring` (50% primary) | `oklch(0.47 0.17 263 / 0.5)` |
| Sidebar | `bg-sidebar`, `border-sidebar-border`, `text-sidebar-foreground` | see file |
| Charts | `var(--chart-1..5)` | sapphire, sky, amber, emerald, slate |
| Radius | `rounded-sm/md/lg/xl/2xl/3xl/4xl` | 0.45 / 0.6 / 0.75 / 1.05 / 1.35 / 1.65 / 1.95 rem |

**Custom utilities (core of the look):**
- `surface`: the standard card skin (white, 6% ink ring, two-layer soft shadow). Combine with `rounded-xl`.
- `surface-raised`: hover/lifted state and empty-state icon tiles.
- `tile-primary`: the glossy sapphire gradient for active nav icons, the brand "T", the active step, and selected choice icons.
- `bg-grid-fade`: radial sapphire wash at the top of every page (applied by `<Page>`).
- `tabular`: tabular numbers. Use it for durations, counts, and credits.

**Typography conventions (no type tokens; apply these classes):**
- Page title: `text-2xl font-semibold tracking-tight text-balance md:text-[30px] md:leading-tight`. Use `PageHeader`.
- Panel title: `text-sm font-semibold`. Panel description: `text-xs leading-relaxed text-muted-foreground`.
- Body: `text-sm`. Meta: `text-xs text-muted-foreground`. Badges: `text-[11px] font-medium`. Group labels: `text-[10px]`/`text-[11px] uppercase tracking-wide`.
- Big numbers: `text-[26px] leading-none font-semibold tracking-tight tabular` (from `Stat`).
- Timecodes: `font-mono text-[11px] text-muted-foreground` (see `components/calls/recent-calls.tsx`).
- ⚠️ `font-heading` is used in `components/numbers/number-ui.tsx` (`WizardShell`, `StepIntro`), but **no `--font-heading` is defined** in `@theme`, so it falls back to the sans font. Don't rely on it. Either omit it or add `--font-heading: var(--font-sans)` to `@theme inline`.
- Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). There are no custom ones.
- Dark mode: primitives include `dark:` classes, but the app is **light only**. Do not add dark styles.

---

## 3. Layout shell & navigation

### 3.1 Files
| File | Role |
|---|---|
| `app/layout.tsx` | Root `<html>`: Geist fonts, `TooltipProvider`, `<Toaster position="bottom-right"/>`, metadata `title: { template: '%s · Transovo' }`, viewport `themeColor #f8f9fb`, `colorScheme light` |
| `app/app/layout.tsx` | Authenticated `/app/*` layout. Reads cookie `transovo_shell_context` (`'power_dialer' \| 'workspace'`), renders `<AppShell initialShellContext>` + `PowerDialerImpersonationBanner` (power-dialer only; drop for clipping) |
| `components/shell/app-shell.tsx` | Providers `ShellContextProvider > WorkspaceProvider > NumbersProvider > AgentProvider`; layout `flex min-h-dvh flex-col`; `AppHeader`, `IncomingCallBar`, `ActiveCallBar`; sticky left sidebar; `<main id="main" className="min-w-0 flex-1">`; mobile `Sheet side="left"` (w-64) with `SidebarNav` |
| `components/shell/app-header.tsx` | Sticky top bar `sticky top-0 z-40 h-16 border-b bg-card/85 backdrop-blur-xl`. Left: brand tile (`tile-primary size-8` "T" + "Transovo"), workspace dropdown, **product tabs** from `PRODUCTS` (active underline `h-0.5 bg-primary`), mobile product dropdown. Right: `GlobalSearch`, "Dial" button, utility icon links with `Tooltip` (Home, Inbox + unread badge, Contacts, Integrations, Settings, Help), account `DropdownMenu` (hardcoded "Maya Okafor"; Settings; "Billing & usage" → `/app/settings?tab=billing`) |
| `components/shell/sidebar-nav.tsx` | Context header (icon box `size-8 rounded-lg surface text-primary` + title + subtitle), grouped items (10px uppercase group label), items are `Link` `h-8 gap-2.5 px-1.5 text-sm`; **active item = `surface` bg + icon in `tile-primary`**; compact mode (collapsed `w-20`) stacks icon over a 10px label; `data-testid="nav-<path>"`; footer has a phone-only "Main line connected" pill + Collapse/Expand toggle |
| `components/shell/use-resolved-nav-context.ts`, `shell-context-provider.tsx`, `lib/nav-shell-context.ts` | Decide which product context owns the sidebar for a pathname (cookie-persisted for shared CRM routes) |
| `components/shell/global-search.tsx`, `notifications-popover.tsx`, `active-call-bar.tsx` | Header search, notifications popover, live call bars (phone-specific) |
| `lib/nav.ts` | **Single source of truth for nav.** `PRODUCTS`, `WORKSPACE` context, `resolveContext()`, `isItemActive()`, `groupItems()`, `ALL_CONTEXTS` |

Sidebar geometry: `aside` `sticky top-16 h-[calc(100dvh-4rem)] border-r border-sidebar-border bg-sidebar`, `w-20` collapsed (default) / `w-60` expanded, `hidden md:block`.

### 3.2 Nav model (`lib/nav.ts`)
```ts
type ProductKey = 'phone' | 'receptionist' | 'mctb' | 'power_dialer'
type ContextKey = ProductKey | 'workspace'
type NavItem    = { title: string; href: string; icon: LucideIcon; group?: string; exact?: boolean; isActive?: (pathname: string) => boolean }
type NavContext = { key: ContextKey; title: string; shortTitle: string; href: string; icon: LucideIcon; items: NavItem[] }
```
- `PRODUCTS: NavContext[]` drives the **header product tabs** and the **sidebar for that product's URL prefix**. Today they are Phone (`/app/phone`), Conversational IVR/Receptionist (`/app/receptionist`), Power Dialer (`/app/power-dialer`, behind `POWER_DIALER_UI_ENABLED`), and MCTB (`/app/mctb`, behind `MCTB_UI_ENABLED`). Flags come from `lib/products/mctb-ui.ts`, `lib/products/power-dialer.ts`, and `lib/receptionist/runtime-profile`.
- `WORKSPACE` context (`/app/home`) covers Home, Inbox, Contacts, Numbers (group "Workspace") and Integrations, Settings, Help (group "Manage").

### 3.3 How to add the clipping product + a route (recipe)
1. **Add a product context** in `lib/nav.ts`. Add `'clips'` to `ProductKey`, then add an entry to `PRODUCTS`:
   ```ts
   { key: 'clips', title: 'Clips', shortTitle: 'Clips', href: '/app/clips', icon: Scissors,
     items: [
       { title: 'Projects',  href: '/app/clips', icon: LayoutGrid, exact: true, group: 'Create' },
       { title: 'Upload',    href: '/app/clips/new', icon: Upload, group: 'Create' },
       { title: 'Brand kit', href: '/app/clips/brand', icon: Palette, group: 'Customize' },
       { title: 'Exports',   href: '/app/clips/exports', icon: Download, group: 'Library' },
     ] }
   ```
   `resolveContext()` matches by `href` prefix, so the header tab and sidebar appear automatically. To retire old products, remove their entries from `PRODUCTS` (or keep their flags false) and update `WORKSPACE.items` (drop Inbox/Contacts/Numbers).
2. **Create the page** at `app/app/clips/page.tsx` (URL `/app/clips`). Keep it a thin **server component**:
   ```tsx
   import { Page, PageHeader } from '@/components/app/page-primitives'
   import { ClipProjectsGrid } from '@/components/clips/projects-grid'
   export const metadata = { title: 'Projects · Clips' }      // renders "Projects · Clips · Transovo"
   export default function ClipsPage() {
     return (
       <Page>
         <PageHeader title="Projects" description="…" actions={/* Button */} />
         <ClipProjectsGrid />
       </Page>
     )
   }
   ```
3. Put interactive UI in `components/clips/<feature>.tsx` with `'use client'`.
4. For a section sub-nav (tabs across sibling routes), copy `components/contacts/contacts-subnav.tsx` and mount it in `app/app/clips/<section>/layout.tsx`, as `app/app/contacts/layout.tsx` does. Active pill: `bg-primary/10 text-primary font-medium`.
5. Clean up the shell for clipping. Remove or neutralize the phone-specific parts: `IncomingCallBar`/`ActiveCallBar`, `NumbersProvider`/`AgentProvider`, the header "Dial" button, the Inbox badge from `THREADS`, the sidebar "Main line connected" footer pill, and `PowerDialerImpersonationBanner`. The `WorkspaceProvider` is a ~760-line Telnyx WebRTC call-state provider, so replace it with a slim workspace/user context.

---

## 4. Component inventory

### 4.1 `components/ui/*` (shadcn base-nova on @base-ui/react): 21 primitives
`avatar, badge, button, card, chart, checkbox, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, sonner, switch, table, tabs, textarea, tooltip`

| Primitive | Key API / notes |
|---|---|
| `button.tsx` | `Button` + `buttonVariants`. Variants: `default` (glossy sapphire gradient + inset highlight), `outline`, `secondary`, `ghost`, `destructive` (tinted), `link`. Sizes: `default` h-8, `xs` h-6, `sm` h-7, `lg` h-9, `icon` size-8, `icon-xs`, `icon-sm`, `icon-lg`. **Polymorphism uses `render={<Link href=… />}`, not `asChild`.** Icons inside get `data-icon="inline-start" \| "inline-end"`. For links you can also use `className={buttonVariants({variant:'outline'})}` on `<Link>` |
| `badge.tsx` | variants `default, secondary, destructive, outline, ghost, link`; `rounded-4xl h-5`; `useRender`-based. For statuses prefer `StatusBadge` (§4.2) |
| `card.tsx` | `Card` (`size: default\|sm`, `rounded-xl ring-1 ring-foreground/10`), `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` (`bg-muted/50 border-t`). **An `<img>` as first child renders edge-to-edge with `rounded-t-xl`**, which suits clip thumbnails. (App code more often uses `rounded-xl surface` articles than `Card`.) |
| `dialog.tsx` | `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay` (`bg-black/10 backdrop-blur-xs`), `DialogContent` (`showCloseButton`, default `sm:max-w-sm rounded-xl p-4`; widen with `className="sm:max-w-3xl"`), `DialogHeader/Footer/Title/Description` |
| `sheet.tsx` | `side: top\|right\|bottom\|left` (default right, `sm:max-w-sm`), Header/Footer/Title/Description. Use for clip detail/inspector drawers |
| `tabs.tsx` | `Tabs, TabsList` (`variant: default` muted pill \| `line`), `TabsTrigger`, `TabsContent` (`keepMounted`). Controlled + URL-synced pattern in `components/settings/settings-tabs.tsx` |
| `progress.tsx` | `Progress value` (h-1 track, `bg-primary` indicator) + `ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue` |
| `select.tsx` | base-ui Select: `Select` (Root, supports `items` prop), `SelectTrigger` (`size: sm\|default`), `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`. App code usually wraps it via `SimpleSelect` |
| `dropdown-menu.tsx` | base-ui Menu: `DropdownMenu, Trigger (render={<Button …/>}), Content, Group, Label, Item (variant default\|destructive), CheckboxItem, RadioGroup, RadioItem, Sub, SubTrigger, SubContent, Separator, Shortcut` |
| `popover.tsx` | `Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription` |
| `tooltip.tsx` | `TooltipProvider` (already in root layout), `Tooltip, TooltipTrigger, TooltipContent` (dark `bg-foreground` bubble with arrow) |
| `avatar.tsx` | `Avatar (size sm\|default\|lg), AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount` |
| `switch.tsx` | `Switch (size sm\|default)`, `checked/onCheckedChange` |
| `input.tsx`, `textarea.tsx`, `label.tsx`, `checkbox.tsx`, `separator.tsx` | standard; `Input` is `h-8 rounded-lg` and also used with `type="file"`/`type="date"` |
| `table.tsx` | `Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption`. In a Panel use `bodyClassName="p-0"` and `pl-5`/`pr-5` on edge cells |
| `chart.tsx` | `ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle`, `type ChartConfig` |
| `sonner.tsx` | `Toaster` (light, lucide icons). Call `toast.success('…', { description })` / `toast.error(msg)` / `toast('…')` from `sonner` |

**Not installed** (add with the shadcn CLI using the same `base-nova` style so they match; check that `components.json` stays unchanged): `skeleton`, `slider`, `scroll-area`, `toggle-group`, `radio-group`, `accordion`, `alert`, `command`, `hover-card`, `breadcrumb`, `pagination`, `form`, `aspect-ratio`, `resizable`. The command is `pnpm dlx shadcn@latest add skeleton slider scroll-area toggle-group` from `new-app/`.

### 4.2 `components/app/*`: app-level building blocks (**use these first**)
| File | Exports |
|---|---|
| `page-primitives.tsx` | **`Page`** (`relative` + `bg-grid-fade h-72` backdrop + `mx-auto max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8`; pass `className` to change max width) · **`PageHeader {title, description?, eyebrow?, actions?, breadcrumbs?: {label, href?}[]}`** · **`IconTile {icon, tone: default\|primary\|success\|warning\|danger, size: sm\|md}`** · **`Panel {title?, description?, actions?, icon?, className?, bodyClassName?}`** (`rounded-xl surface`; header `border-b border-border/70 bg-linear-to-b from-muted/40 px-5 py-3.5`; body `p-5`; use `bodyClassName="p-0"` for lists/tables, `"divide-y py-0"` for setting rows) · **`Stat {label, value, hint?, tone?: default\|warning\|danger\|success, href?, icon?}`** (auto-icons via `STAT_ICONS` regexes, which are phone-oriented and fall back to `Sparkles`, so **pass `icon` explicitly** for clip stats or extend `STAT_ICONS`) · **`EmptyState {icon, title, description, action?}`** · **`KeyValue {items: {label, value}[]}`** |
| `status.tsx` | **`StatusBadge {tone: neutral\|info\|success\|warning\|danger\|muted}`** (pill `h-5 text-[11px]` with a colored dot), `type Tone`. Also phone maps `CALL_OUTCOME`, `AI_OUTCOME`, `MCTB_STATE`; add a `CLIP_JOB_STATE: Record<State, {label, tone}>` in the same style |
| `filters.tsx` | **`SegmentedFilter {value, onChange, options: {value,label,count?}[], label}`** (pill radios; active `bg-foreground text-background`), **`SearchInput {value,onChange,placeholder}`**, **`SimpleSelect {value,onChange,options,label,disabled?}`** |
| `option-group.tsx` | **`OptionGroup`** (radio cards in 1/2/3 columns), **`SettingRow {title, description, control}`** |
| `charts.tsx` | **`TrendChart`** (area), **`BarsChart`** (vertical/horizontal), **`Funnel`** |
| `range-select.tsx` | 7d / 30d / 90d range select |
| `routing-summary.tsx` | phone-specific, skip |

### 4.3 Feature-folder components worth reusing as patterns
| File | Reusable pieces |
|---|---|
| `components/numbers/number-ui.tsx` | **`WizardShell`** (full-height stepper: sticky header with title + `StepRail`, `max-w-3xl` body, sticky footer with Back/Continue, "Discard this setup?" confirm `Dialog` when `dirty`), **`StepRail`**, **`ChoiceCard`** (radio card: `surface-raised` → selected `bg-accent/60 ring-2 ring-primary`, icon tile turns `tile-primary`), **`StepIntro`**, **`Field {id,label,hint?}`**, **`Callout {tone: info\|warning\|danger\|success, title?, icon?}`**, `FlowDiagram` (numbered vertical steps), `CapabilityChips`, `ProductChips` |
| `components/receptionist/ai-ui.tsx` | **`DraftBar`** (sticky `bg-background/85 backdrop-blur-md` save/discard/publish bar with "Unsaved edits" indicator, which maps well to an editor save bar), **`Section`** (collapsible `rounded-xl surface` section with `IconTile` + chevron), **`JumpChips`** (anchor chips), `ToggleRow`, `Pills`, `NotAvailable`, `DemoNote` |
| `components/settings/settings-tabs.tsx` | URL-synced `Tabs` (`?tab=`), `Field`, `ToggleRow`, team `Table`, **usage meters with `Progress` + 80% warning text** (the billing tab) |
| `components/receptionist/knowledge-manager.tsx` | Async list pattern: `SegmentedFilter` as view switcher with counts, `Panel bodyClassName="p-0"` + `ul.divide-y` rows (icon · name/meta · `StatusBadge` · icon `Button`), inline empty rows, **file upload via `<Input type="file">` + `toast`** |
| `components/integrations/integrations-catalog.tsx` | **Card grid**: `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3` of `article.flex.flex-col.gap-4.rounded-xl.surface.p-5` with a gradient icon tile, meta `dl`, and a `mt-auto` action row; category headings `text-sm font-semibold text-muted-foreground` |
| `app/app/home/page.tsx` | Dashboard layout: `Stat` row `grid-cols-2 md:grid-cols-4`, product cards `md:grid-cols-3`, `lg:grid-cols-3` with `lg:col-span-2` main + side `Panel` checklist (`CheckCircle2` done / `Circle` to-do) |
| `components/calls/calls-table.tsx` | Filterable data list: filter bar (`SegmentedFilter`, `SearchInput`, `SimpleSelect`, date `Input`s) → error banner (`border-destructive/30 bg-destructive/5` + Retry) → `EmptyState` with "Clear filters" → desktop `<table>` / mobile `<ul>` → pager footer (`"1–25 of N"` + `icon-sm` outline chevron buttons) |
| `components/calls/recent-calls.tsx` | Compact linked list in a `Panel` with a "View all" action; row = icon · title/subtitle · badge · time + `font-mono` duration |
| `components/calls/call-recording-player.tsx` | Media playback pattern: HEAD-check the stream URL → "Preparing playback…" / error text → native `<audio controls preload="metadata">` → download link. Swap in `<video>` for clips |
| `components/contacts/contacts-subnav.tsx`, `components/power-dialer/analytics-nav.tsx` | Route sub-nav pills |
| `components/power-dialer/csv-import-wizard.tsx` | Multi-step file import wizard (reference for upload → map → confirm) |
| `components/power-dialer/team-settings-panel.tsx`, `settings-content.tsx`, `developer-settings-panel.tsx` | Settings panel patterns (team, API keys) |
| `components/help/help-center.tsx` | Help page |

### 4.4 Reuse map for clipping features
| Clipping need | Build it from | Notes |
|---|---|---|
| **Upload / dropzone** | `Panel` + a dashed drop target styled with tokens + `<Input type="file">` (hidden) + `Button`; URL import row = `Input type="url"` + `Button` (copy the "Add a source" panel in `knowledge-manager.tsx`); progress with `Progress` | No dropzone exists. See §7 for the exact recipe |
| **Progress / processing status** | `Progress` (+ `ProgressLabel/ProgressValue`), `StatusBadge` tones (queued=`muted`, uploading/processing=`info`, ready=`success`, needs review=`warning`, failed=`danger`), `StepRail` for pipeline stages (Upload → Transcribe → Find clips → Render), `Callout` for errors, `Loader2 className="animate-spin"` in buttons, `toast` on completion | Poll with `useEffect` + `setInterval`, or SSE. There is no React Query |
| **Media cards grid** | Grid from `integrations-catalog.tsx` + `Card` with first-child image (or `article.rounded-xl.surface.overflow-hidden`), `StatusBadge`, duration chip in `font-mono tabular`, `DropdownMenu` kebab (`MoreHorizontal`), `SegmentedFilter` + `SearchInput` + `SimpleSelect` above it, `EmptyState` | Grid columns `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Vertical clips use `aspect-[9/16]` |
| **Video player** | Pattern from `call-recording-player.tsx` with native `<video controls playsInline preload="metadata">` in a `rounded-xl overflow-hidden bg-foreground` frame; controls built from `Button size="icon-sm" variant="ghost"` + (new) `Slider` | No video player exists |
| **Timeline / transcript editor** | Layout: `Page className="max-w-none"` or a full-height shell like `WizardShell`; left = player `Panel`, right = transcript `Panel bodyClassName="p-0"` with a scrollable word list (`ScrollArea` to add); top = `DraftBar`-style sticky save/export bar; inspector = `Sheet side="right"` or `Tabs` (Captions / Layout / Brand / Export) | Fully new. See §7 |
| **Settings** | `app/app/settings/page.tsx` + `components/settings/settings-tabs.tsx` (add tabs `brand`, `export`, `integrations`), `Panel` + `Field` / `ToggleRow` / `SettingRow` / `OptionGroup` / `ChoiceCard` | Already URL-synced with `?tab=` |
| **Billing / credits / pricing** | Billing tab in `settings-tabs.tsx` (plan `Panel` + usage `Progress` meters, warning at ≥80%); `Stat` for the credits balance; pricing tiers via `OptionGroup`/`ChoiceCard` or a `surface` card grid; header account menu already links "Billing & usage" → `/app/settings?tab=billing` | Backend is stubs: `lib/billing/entitlements.ts`, `lib/settings/billing.ts`, `lib/stripe/client.ts` |
| **Empty states** | `EmptyState` (from `page-primitives.tsx`) inside a `Panel` or on its own; inline empty rows `px-5 py-8 text-center text-sm text-muted-foreground` | e.g. `icon={Clapperboard}` "No projects yet", action `<Button><Upload/>Upload video</Button>` |
| **Stats / analytics** | `Stat`, `TrendChart`, `BarsChart`, `RangeSelect` | |
| **Wizards (new project, brand kit setup)** | `WizardShell`, `StepRail`, `ChoiceCard`, `StepIntro`, `Field`, `Callout` | |
| **Confirm / destructive** | `Dialog` + `DialogFooter` with `outline` + `destructive` buttons (as in `WizardShell`) | |
| **Detail drawer** | `Sheet` (`side="right"`, widen `sm:max-w-lg`) + `KeyValue` | |

---

## 5. Pages & routes

All routes are under `new-app/app/`. Pages are **thin** (100–900 bytes): metadata + `<Page><PageHeader/>…<FeatureComponent/></Page>`. Exceptions are `app/app/home/page.tsx` (~5 KB) and `app/app/phone/page.tsx` (~8 KB).

| URL | Status for clipping product |
|---|---|
| `/` (`app/page.tsx`) | SHARED: redirect to `/app/home` (later becomes the marketing/landing page) |
| `app/layout.tsx` (root layout) | SHARED: keep |
| `/app` (`app/app/page.tsx`) | SHARED: redirect to `/app/home` (point to `/app/clips` once built) |
| `app/app/layout.tsx` (shell layout) | SHARED: keep, strip power-dialer banner/cookie logic |
| `/app/calls/[id]` | REMOVE — phone |
| `/app/contacts` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts (layout)` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/[id]` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/calendar` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/companies` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/companies/[id]` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/deals` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/settings` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/contacts/tasks` | REMOVE (CRM; tied to power dialer) — keep only as pattern reference |
| `/app/help` | SHARED — keep & adapt |
| `/app/home` | SHARED — keep & adapt |
| `/app/inbox` | REMOVE (SMS/voicemail inbox) — pattern reference only |
| `/app/integrations` | SHARED — keep & adapt |
| `/app/mctb` | REMOVE — SMS / MCTB |
| `/app/mctb/analytics` | REMOVE — SMS / MCTB |
| `/app/mctb/calls` | REMOVE — SMS / MCTB |
| `/app/mctb/calls/[id]` | REMOVE — SMS / MCTB |
| `/app/mctb/compliance/consent` | REMOVE — SMS / MCTB |
| `/app/mctb/conversations` | REMOVE — SMS / MCTB |
| `/app/mctb/onboarding` | REMOVE — SMS / MCTB |
| `/app/mctb/recovery` | REMOVE — SMS / MCTB |
| `/app/mctb/setup` | REMOVE — SMS / MCTB |
| `/app/mctb/voicemail` | REMOVE — SMS / MCTB |
| `/app/numbers` | REMOVE — phone |
| `/app/numbers/[id]` | REMOVE — phone |
| `/app/numbers/connect` | REMOVE — phone |
| `/app/numbers/connections/[id]` | REMOVE — phone |
| `/app/numbers/new` | REMOVE — phone |
| `/app/numbers/port` | REMOVE — phone |
| `/app/numbers/ports/[id]` | REMOVE — phone |
| `/app/phone` | REMOVE — phone |
| `/app/phone/analytics` | REMOVE — phone |
| `/app/phone/auto-attendant` | REMOVE — phone |
| `/app/phone/auto-attendant/[id]` | REMOVE — phone |
| `/app/phone/auto-attendant/new` | REMOVE — phone |
| `/app/phone/business-hours` | REMOVE — phone |
| `/app/phone/call-handling` | REMOVE — phone |
| `/app/phone/calls` | REMOVE — phone |
| `/app/phone/calls/[id]` | REMOVE — phone |
| `/app/phone/dialer` | REMOVE — phone |
| `/app/phone/forwarding` | REMOVE — phone |
| `/app/phone/forwarding/setup` | REMOVE — phone |
| `/app/phone/missed-call-text-back` | REMOVE — phone |
| `/app/phone/numbers` | REMOVE — phone |
| `/app/phone/power-dialer` | REMOVE — phone |
| `/app/phone/voicemail` | REMOVE — phone |
| `/app/power-dialer` | REMOVE — power dialer |
| `/app/power-dialer/analytics` | REMOVE — power dialer |
| `/app/power-dialer/analytics/campaigns` | REMOVE — power dialer |
| `/app/power-dialer/analytics/numbers` | REMOVE — power dialer |
| `/app/power-dialer/analytics/representatives` | REMOVE — power dialer |
| `/app/power-dialer/analytics/screening` | REMOVE — power dialer |
| `/app/power-dialer/analytics/usage` | REMOVE — power dialer |
| `/app/power-dialer/call-history` | REMOVE — power dialer |
| `/app/power-dialer/call-history/[id]` | REMOVE — power dialer |
| `/app/power-dialer/call-history/sessions` | REMOVE — power dialer |
| `/app/power-dialer/callbacks` | REMOVE — power dialer |
| `/app/power-dialer/calling-lists` | REMOVE — power dialer |
| `/app/power-dialer/calling-lists/[id]` | REMOVE — power dialer |
| `/app/power-dialer/campaigns` | REMOVE — power dialer |
| `/app/power-dialer/campaigns/[id]/analytics` | REMOVE — power dialer |
| `/app/power-dialer/campaigns/[id]/contacts` | REMOVE — power dialer |
| `/app/power-dialer/campaigns/[id]/history` | REMOVE — power dialer |
| `/app/power-dialer/campaigns/[id]/queue` | REMOVE — power dialer |
| `/app/power-dialer/dialer` | REMOVE — power dialer |
| `/app/power-dialer/integrations` | REMOVE — power dialer |
| `/app/power-dialer/integrations/[provider]` | REMOVE — power dialer |
| `/app/power-dialer/integrations/sync-history` | REMOVE — power dialer |
| `/app/power-dialer/number-health` | REMOVE — power dialer |
| `/app/power-dialer/number-health/[phoneNumberId]` | REMOVE — power dialer |
| `/app/power-dialer/number-health/free-tools` | REMOVE — power dialer |
| `/app/power-dialer/number-health/premium` | REMOVE — power dialer |
| `/app/power-dialer/settings` | REMOVE — power dialer |
| `/app/receptionist` | REMOVE — AI agent / voice |
| `/app/receptionist/activate` | REMOVE — AI agent / voice |
| `/app/receptionist/agent` | REMOVE — AI agent / voice |
| `/app/receptionist/analytics` | REMOVE — AI agent / voice |
| `/app/receptionist/appointments` | REMOVE — AI agent / voice |
| `/app/receptionist/call-handling` | REMOVE — AI agent / voice |
| `/app/receptionist/call-routing` | REMOVE — AI agent / voice |
| `/app/receptionist/calls` | REMOVE — AI agent / voice |
| `/app/receptionist/calls/[id]` | REMOVE — AI agent / voice |
| `/app/receptionist/knowledge` | REMOVE — AI agent / voice |
| `/app/receptionist/message-taking` | REMOVE — AI agent / voice |
| `/app/receptionist/test` | REMOVE — AI agent / voice |
| `/app/settings` | SHARED — keep & adapt |
**API routes** are `app/api/**/route.ts`. Groups: `contacts` (3), `crm` (23), `health`, `integrations` (7), `internal`, `mctb` (5), `merchant-payments` (4), `numbers` (6), `phone` (107), `receptionist` (18), `telnyx` (2), `v1` (16). Almost all are phone/voice/SMS. Keep `health`, `integrations` (if reused), and anything that serves settings/billing. Server logic is in `lib/server/*` (~640 files, mostly `voice-v3` and `phone`). Shared server helpers to keep: `lib/server/db.ts`, `lib/server/workspace.ts`, `lib/server/workspace-operator.ts`, `lib/server/api-error.ts`, `lib/server/dev-api-guard.ts`, `lib/server/public-url.ts`, `lib/server/internal-user.ts`, `lib/api-auth.ts`, `lib/email/brevo.ts`, `lib/stripe/client.ts`, `lib/billing/*`, `lib/settings/*`, `lib/supabase/id.ts` (`createId(prefix)`; no Supabase dependency despite the name).

**Missing shared pages:** there are no auth pages (login, signup, reset, invite accept), no pricing/plans page, no onboarding for a new product, and no 404/`error.tsx`/`loading.tsx` conventions in the shell.

---

## 6. Conventions

**Files & naming**
- kebab-case filenames, PascalCase named exports (`export function ClipCard`), **no default exports for components** (pages/layouts use `export default`).
- Feature UI goes in `components/<feature>/`. Cross-feature app blocks go in `components/app/`. Primitives go in `components/ui/`, and you should only touch those through the shadcn CLI.
- Imports use the `@/` alias (`@/components/...`, `@/lib/...`). There is no `hooks/` dir; colocate hooks in the feature folder (e.g. `components/shell/use-resolved-nav-context.ts`).
- Client API wrappers go in `lib/<feature>-api.ts`. Server-only logic goes in `lib/server/<feature>/`.

**Pages**
- Server component, `export const metadata = { title: '<Page> · <Product>' }` (root template appends ` · Transovo`).
- Always `<Page>` → `<PageHeader title description actions breadcrumbs?>` → content. Header actions are `Button`s or `<Link className={buttonVariants(...)}>`.
- Read `searchParams` as a Promise: `async function P({ searchParams }: { searchParams: Promise<{…}> }) { const { filter } = await searchParams }`.
- Wrap client components that call `useSearchParams()` in `<Suspense>` (see `app/app/settings/page.tsx`).
- Detail pages pass `breadcrumbs`.

**Components & styling**
- Use `cn()` from `@/lib/utils` for conditional classes. Use tokens only; never hex/oklch literals in components (gradients for special tiles belong in `globals.css` utilities).
- Cards/sections: `rounded-xl surface` (or `Panel`). Hover-lift: `hover:-translate-y-px hover:surface-raised transition-all`. Selected: `bg-accent/60 ring-2 ring-primary`.
- Tinted states use `bg-<tone>/10` (or `/8`, `/15`) + `text-<tone>` + `ring-1 ring-inset ring-<tone>/20`, as in `StatusBadge`/`IconTile`/`Callout`.
- Spacing rhythm: page `gap-6`, grids `gap-3`/`gap-4`, panel padding `p-5`/`px-5 py-3.5`, list rows `px-5 py-3`/`py-4` with `divide-y`.
- Base-UI composition: `render={<Link href="…" />}` (no `asChild`). Icons inside buttons need no size class (the button sizes them); add `data-icon="inline-start|inline-end"`.
- Icons: lucide only; `size-4` default, `size-3.5` small, `size-5` in 10–12 px tiles; decorative icons get `aria-hidden`.
- Accessibility: `aria-label` on icon buttons, `sr-only` labels, `role="alert"` for errors, `aria-current` on active steps and links, and `aria-label` on `<section>`/`<nav>`.
- Test hooks: `data-testid` on nav items (`nav-<path>`); follow suit for key controls.
- Responsiveness: mobile-first; hide secondary columns with `hidden md:table-cell` / `hidden sm:flex`; the mobile list replaces the table below `md`.

**State & data**
- Client components: `useState` + `useEffect`/`useCallback` `reload()` + `Promise.all`; loading text `"Loading …"` (`text-sm text-muted-foreground`); errors via `toast.error(e instanceof Error ? e.message : 'Fallback')`; successes via `toast.success('Done', { description })`.
- API wrapper shape (`lib/receptionist-api.ts`):
  ```ts
  async function parse<T>(res: Response): Promise<T> {
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || res.statusText)
    return (json.data ?? json) as T
  }
  export async function fetchClipProjects() { return parse<ClipProjectDto[]>(await fetch('/api/clips/projects')) }
  ```
- API route shape (`app/api/phone/settings/route.ts`):
  ```ts
  export const dynamic = 'force-dynamic'
  export async function GET() {
    try { const workspaceId = await resolveWorkspaceId(); return NextResponse.json({ data: await getThing(workspaceId) }) }
    catch (err) { return jsonError(err, 500) }          // from '@/lib/server/api-error' → { error }
  }
  ```
  Responses are `{ data }` on success and `{ error }` on failure. Mutating routes call `assertDevApiAccess(request)` (`lib/server/dev-api-guard.ts`) until real auth exists. Validate bodies (zod or explicit `typeof` checks). IDs come from `createId('clip')`.
- Shared state goes in a React context provider in `components/providers/` mounted in `AppShell`. Use one small provider per concern, not another monolith.
- Dates/durations: `lib/format.ts` has `formatDuration(sec)` → `m:ss` (`'—'` for 0), `formatWhen(iso)`, `formatFull(iso)`, `initials(name)`. ⚠️ `formatWhen` uses a **hardcoded `NOW` (2026-10-18) and `America/Chicago`** for mock data. Fix it to `Date.now()` and the user/workspace TZ before relying on it.
- Unsaved-changes UX: `DraftBar` (sticky save/discard) and the `WizardShell` discard-confirm dialog.

---

## 7. Gaps & how to build them from existing primitives

Create a `components/clips/` folder. Each item below names the primitives to compose.

1. **Install missing primitives (base-nova style):** `skeleton` (grid/list loading instead of "Loading…" text), `slider` (scrubber, trim handles, volume), `scroll-area` (transcript, timeline), `toggle-group` (aspect ratio 9:16 / 1:1 / 16:9, caption style), `radio-group`, `accordion`, `aspect-ratio` (optional; `aspect-[9/16]` works too). Install them from `new-app/` with `pnpm dlx shadcn@latest add …`.

2. **`Dropzone`** (`components/clips/dropzone.tsx`, client):
   ```tsx
   <label htmlFor="clip-file"
     className={cn('flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-input bg-card px-6 py-12 text-center transition-colors',
       dragging ? 'border-primary bg-accent/60' : 'hover:border-primary/50 hover:bg-muted/40')}
     onDragOver={…} onDragLeave={…} onDrop={…}>
     <span className="flex size-12 items-center justify-center rounded-xl surface-raised text-primary"><UploadCloud className="size-5" /></span>
     <div className="flex flex-col gap-1"><p className="text-sm font-semibold">Drop a video or click to upload</p>
       <p className="text-sm text-muted-foreground">MP4, MOV, WEBM · up to 10 GB · or paste a YouTube link</p></div>
     <span className={buttonVariants({ size: 'sm' })}><Upload data-icon="inline-start" />Choose file</span>
     <input id="clip-file" type="file" accept="video/*" className="sr-only" onChange={…} />
   </label>
   ```
   Pair it with a URL row (`Input type="url"` + `Button`) inside a `Panel title="New project"`. Upload large files **direct to object storage** (presigned PUT/multipart from a new `app/api/clips/uploads/route.ts`) with `XMLHttpRequest`/`fetch` progress driving `Progress`. Do not copy the knowledge-upload route (base64 into a DB row, 25 MB max).

3. **`UploadProgressItem` / `JobStatus`:** a row in a `Panel bodyClassName="p-0"` `ul.divide-y`: `FileVideo` icon · name + `text-xs` meta (size, `formatDuration`) · `Progress` (`w-40`) + `tabular` % · `StatusBadge` · cancel `Button size="icon-sm" variant="ghost"`. For multi-stage processing, show `StepRail` with steps `['Upload','Transcribe','Find clips','Render']`. Add `CLIP_JOB_STATE` in `components/app/status.tsx` style.

4. **`ClipCard` + `ClipGrid`:**
   ```tsx
   <article className="group flex flex-col overflow-hidden rounded-xl surface transition-all hover:-translate-y-px hover:surface-raised">
     <div className="relative aspect-[9/16] bg-muted">  {/* or aspect-video for projects */}
       <img src={thumb} alt="" className="size-full object-cover" />
       <span className="absolute right-2 bottom-2 rounded-md bg-foreground/80 px-1.5 py-0.5 font-mono text-[11px] text-background tabular">{formatDuration(sec)}</span>
       <span className="absolute top-2 left-2"><StatusBadge tone="success">Virality 92</StatusBadge></span>
     </div>
     <div className="flex flex-col gap-1 p-4"><h3 className="line-clamp-2 text-sm font-medium">{title}</h3>
       <p className="text-xs text-muted-foreground">{formatWhen(createdAt)}</p></div>
     <div className="mt-auto flex gap-2 border-t px-4 py-3"> <Button size="sm" variant="outline" className="flex-1">Edit</Button> <DropdownMenu>…</DropdownMenu></div>
   </article>
   ```
   Grid: `grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4`. Toolbar above: `SegmentedFilter` (All / Ready / Processing / Failed with counts) + `SearchInput` + `SimpleSelect` (sort). Use `Skeleton` cards while loading and `EmptyState` when there's nothing.

5. **`VideoPlayer`:** a `rounded-xl overflow-hidden bg-foreground` frame with `<video playsInline preload="metadata">` (borrow the HEAD-check/error pattern from `call-recording-player.tsx`). Controls bar: `Button variant="ghost" size="icon-sm"` (Play/Pause, SkipBack/Forward, Volume2, Maximize), `Slider` scrubber, `font-mono text-[11px] tabular` time readout. Expose `currentTime` via a small context so the transcript/timeline can sync.

6. **Clip editor (timeline + transcript):** full-height layout copied from `WizardShell`'s structure (sticky top bar under the 64px header: `sticky top-16 z-20 border-b bg-background/85 backdrop-blur-md`). It holds the title, `DraftBar`-style status, Save and Export (`Button` default). The body is `grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6`.
   - Left: `VideoPlayer` above a **timeline** `Panel bodyClassName="p-0"`. Build the timeline as a horizontal `ScrollArea` with a time ruler (`text-[10px] text-muted-foreground tabular`), clip segment blocks (`rounded-md bg-primary/15 ring-1 ring-primary/30`, selected `tile-primary`), trim handles from `Slider` (range) or draggable `w-1.5 bg-primary` grips, and a playhead `w-px bg-destructive`.
   - Right: `Tabs` (`variant="line"`) with Transcript / Captions / Layout / Brand. The Transcript tab is a `ScrollArea` of word `<button>`s (`rounded px-0.5 hover:bg-muted`; active word `bg-accent text-accent-foreground`; removed words `line-through text-muted-foreground`), and click seeks the player. Caption style presets use `ChoiceCard`/`OptionGroup`. Aspect uses `ToggleGroup`. Toggles use `ToggleRow`/`SettingRow`.
   - Mobile: stack the columns, and the inspector becomes a `Sheet side="bottom"`.

7. **Export dialog:** `Dialog` with `DialogContent className="sm:max-w-lg"`, `OptionGroup` for resolution/format, `Switch` rows, `Progress` while rendering, then a download `Button render={<a href download />}`.

8. **Credits & pricing:**
   - **Credits balance:** a `Stat label="Credits left" icon={Coins}` on the dashboard, plus a compact header pill (`rounded-full surface px-2.5 h-7 text-xs tabular`) next to the account menu linking to `/app/settings?tab=billing`.
   - **Billing tab:** replace `USAGE` in `settings-tabs.tsx` with "Processing minutes", "Exports", and "Storage" meters (same `Progress` + ≥80% `text-warning-foreground` note). Wire "Manage plan" to the Stripe Customer Portal through a new API route using `getStripe()`.
   - **Pricing page** (`app/app/settings/plans/page.tsx` or public `app/pricing/page.tsx`): a `grid md:grid-cols-3 gap-4` of `rounded-xl surface p-6` tier cards. The recommended tier gets `ring-2 ring-primary` + `StatusBadge tone="info"`, the price is in `text-[30px] font-semibold tabular`, the feature list uses `Check` icons in `text-success`, and the CTA is `Button` (recommended) or `Button variant="outline"`. Add a monthly/annual toggle via `SegmentedFilter`.
   - **Server:** implement `checkCreditBalance`/`deductCredits` in `lib/billing/entitlements.ts`; the Prisma models go in `/prisma/schema.prisma`.

9. **Auth pages** (`app/(auth)/login/page.tsx`, `signup`, …): there are none. Build a centered card with `min-h-dvh grid place-items-center bg-background` + `bg-grid-fade` backdrop, the brand tile (`tile-primary size-8 rounded-lg` "T"), and a `rounded-xl surface p-6 w-full max-w-sm` with `Label`/`Input`/`Button className="w-full"`. Then replace `requireSession()`/`resolveWorkspaceId()` dev stubs and the hardcoded "Maya Okafor" in `app-header.tsx`/`home/page.tsx`.

10. **Loading / error boundaries:** add `app/app/clips/loading.tsx` (`<Page>` + `Skeleton`s) and `error.tsx` (`EmptyState` with `AlertTriangle` + Retry `Button`). The current code uses inline "Loading…" text and a destructive banner (`border-destructive/30 bg-destructive/5 … role="alert"`) with Retry; keep that banner style for in-panel errors.

11. **Shell cleanup for a clips-first product:** in `lib/nav.ts`, set `PRODUCTS = [clips]` (or keep others behind false flags), slim `WORKSPACE.items` to Home, Integrations, Settings, Help. In `app-header.tsx`, replace the "Dial" button with "New project" (`/app/clips/new`), and drop Inbox/Contacts utilities. In `sidebar-nav.tsx`, replace the "Main line connected" footer with a credits meter (`Progress` + `tabular` text). In `app-shell.tsx`, remove call bars and phone providers. Extend `STAT_ICONS` in `page-primitives.tsx` (e.g. `/clip/i → Scissors`, `/export/i → Download`, `/minute/i → Timer`, `/credit/i → Coins`).

### Quick "do / don't"
- ✅ `Page` + `PageHeader` + `Panel` + `StatusBadge` + `EmptyState` + `Button` variants, `rounded-xl surface`, `tile-primary` for the single most important active thing, `toast` for feedback.
- ✅ `render={<Link/>}` for polymorphic base-ui components; `buttonVariants()` on `<Link>`.
- ❌ Radix imports, `asChild`, new color literals, dark-mode styles, a new font, SWR/React Query, a tailwind.config file, importing from the legacy `/src`.
