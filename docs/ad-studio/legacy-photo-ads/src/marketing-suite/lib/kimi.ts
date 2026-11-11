/**
 * Moonshot Kimi API – K2.5 multimodal for ad edit suggestions and VPA EDL.
 * Set KIMI_API_KEY in .env.local (from Moonshot AI / Kimi platform).
 */

import {
  FILM_THEORY_EDITING,
  FILM_THEORY_CTA_AND_VO,
  FILM_THEORY_CLIP_PROFILES_NOTE,
  FILM_THEORY_AUDIO,
} from "@/marketing-suite/lib/video-product-ads/film-theory";
import type { BeatGrid, ClipProfile, EdlEntry, ShotListEntry } from "@/marketing-suite/lib/video-product-ads/types";
import path from "path";
import { promises as fs } from "fs";

const KIMI_BASE = "https://api.moonshot.ai/v1";
const KIMI_FILES_URL = `${KIMI_BASE}/files`;
const KIMI_MODEL = "kimi-k2.5";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_PROOF_MODEL = "gemini-3-flash-preview";

type KimiPhotoAdsRequest = {
  size: "square" | "story" | "portrait" | "landscape";
  headline: string;
  subHeadline: string;
  cta: string;
  productInfo: string;
  brandColors: { primary: string; secondary?: string };
  logoUrl?: string;
  productImageUrl?: string;
  platform?: "facebook" | "instagram" | "tiktok" | "pinterest" | "generic";
  referenceImageUrls?: string[];
};

export type KimiHeadshotRequest = {
  size: "square" | "story" | "portrait" | "landscape";
  personImageUrl: string;
  referenceImageUrls?: string[];
};

export type KimiThumbnailRequest = {
  size: "square" | "story" | "portrait" | "landscape";
  videoAbout: string;
  thumbnailText?: string;
  /** Channel owner / self — identity should stay consistent; creative relight and composition OK. */
  personImageUrls?: string[];
  /** Third-party / video subject photos — entire frame (subject + in-photo background) must stay photoreal and unaltered in the final thumb. */
  preservedPhotoUrls?: string[];
  objectImageUrls?: string[];
  referenceImageUrls: string[];
  creatorBrainSummary?: string;
  /** Extra instructions prepended to the thumbnail prompt request (e.g. Analyze This Video role separation). */
  promptPreamble?: string;
};

/** Vision-extracted identity anchor for headshot prompts (eye color, etc.) so the image model gets explicit ground truth. */
export type HeadshotIdentityCard = {
  eyeColor: string;
  faceShape?: string;
  skinUndertone?: string;
  distinctiveFeatures?: string[];
  signatureAccessories?: string[];
};

export type KimiProjectNoveltyMemory = {
  lookbackCount: number;
  blockedTuples: string[];
  avoidStyleTags: string[];
  avoidConceptMechanics: string[];
  avoidHeroActions: string[];
  avoidLayoutModes: string[];
  avoidEnvironmentFamilies: string[];
  recentConceptCards?: string[];
  requiredNovelty: {
    minUnseenConcepts: number;
    minUnseenHeroActions: number;
    minUnseenTuples: number;
  };
};

type KimiPhotoPromptItem = {
  prompt?: string;
  style?: string;
  layoutNotes?: string;
};

const KIMI_PHOTO_STYLE_TAGS = [
  "signature-premium-product",
  "human-lifestyle",
  "illustrated-graphic",
  "clean-white-packshot",
  "typography-dominant",
  "social-proof-trust",
  "feature-callout-infographic",
  "problem-solution",
  "ui-saas-mockup",
  "discount-promotional",
  "large-product-environment",
  "multi-product-collection",
] as const;

const DEFAULT_LOCAL_REFERENCE_BASENAMES = new Set([
  "kka.png",
  "assss.png",
  "r1.png",
  "r2.png",
  "H1.png",
  "h2.png",
  "h3.png",
  "yt1.png",
  "yt2.png",
  "yt3.png",
]);
const localImageDataUrlCache = new Map<string, { mtimeMs: number; dataUrl: string }>();
const remoteImageDataUrlCache = new Map<string, { expiresAt: number; dataUrl: string }>();
const REMOTE_IMAGE_DATA_URL_CACHE_TTL_MS = 15 * 60 * 1000;
const REMOTE_IMAGE_DATA_URL_CACHE_MAX = 300;
const imageDataUrlCacheStats = {
  localHit: 0,
  remoteHit: 0,
  miss: 0,
};

function logImageDataUrlCacheStats(label: string): void {
  console.log(
    `[Kimi][cache] ${label} | local_hit=${imageDataUrlCacheStats.localHit} remote_hit=${imageDataUrlCacheStats.remoteHit} miss=${imageDataUrlCacheStats.miss}`
  );
}

function pruneRemoteImageDataUrlCache(nowMs: number): void {
  for (const [key, cached] of remoteImageDataUrlCache.entries()) {
    if (cached.expiresAt <= nowMs) remoteImageDataUrlCache.delete(key);
  }
  if (remoteImageDataUrlCache.size <= REMOTE_IMAGE_DATA_URL_CACHE_MAX) return;
  const overflow = remoteImageDataUrlCache.size - REMOTE_IMAGE_DATA_URL_CACHE_MAX;
  let removed = 0;
  for (const key of remoteImageDataUrlCache.keys()) {
    remoteImageDataUrlCache.delete(key);
    removed++;
    if (removed >= overflow) break;
  }
}

type ProductCategory =
  | "apparel-fashion"
  | "beauty-skincare"
  | "food-beverage"
  | "saas-fintech"
  | "tech-electronics"
  | "mobility-large-product"
  | "pet"
  | "home-decor"
  | "service-local"
  | "general";

function inferProductCategory(req: KimiPhotoAdsRequest): ProductCategory {
  const text = `${req.productInfo} ${req.headline} ${req.subHeadline}`.toLowerCase();
  const has = (re: RegExp) => re.test(text);
  if (has(/\b(shirt|t-?shirt|tee|hoodie|jacket|dress|jeans|apparel|fashion|garment|wear)\b/)) return "apparel-fashion";
  if (has(/\b(skincare|serum|beauty|cosmetic|perfume|fragrance|wellness|supplement)\b/)) return "beauty-skincare";
  if (has(/\b(coffee|tea|beverage|drink|snack|food)\b/)) return "food-beverage";
  if (has(/\b(saas|software|app|dashboard|analytics|crm|platform|fintech|crypto|wallet)\b/)) return "saas-fintech";
  if (has(/\b(headphone|earbud|audio|speaker|electronics|gadget|device|anc|bluetooth)\b/)) return "tech-electronics";
  if (has(/\b(e-?bike|bike|scooter|vehicle|furniture|appliance|equipment)\b/)) return "mobility-large-product";
  if (has(/\b(dog|cat|pet|groom|veterinary)\b/)) return "pet";
  if (has(/\b(home|decor|interior|sofa|chair|table|room)\b/)) return "home-decor";
  if (has(/\b(service|local|clinic|medical|plumbing|repair|cleaning)\b/)) return "service-local";
  return "general";
}

function categoryGuardrail(category: ProductCategory): string {
  if (category === "tech-electronics") {
    return "Category guardrail: tech/electronics language is allowed when product truth supports it.";
  }
  return "Category guardrail: do NOT use headphones/electronics-specific language (e.g. earcups, ANC, Bluetooth, deep navy tech void, cyan tech rim-light defaults) unless explicitly present in this product.";
}

function hasMirrorCue(prompt: string): boolean {
  // Intentionally strict: only explicit mirror contexts should trigger guardrails.
  return /\b(mirror|mirrors|bathroom mirror|vanity mirror|in the mirror)\b/i.test(prompt);
}

function withMirrorPhysicsGuardrails(prompt: string): string {
  if (!hasMirrorCue(prompt)) return prompt;
  const hasPhysicsRule = /mirror physics|geometrically consistent|impossible mirror geometry|second person in mirror/i.test(prompt);
  if (hasPhysicsRule) return prompt;
  return `${prompt}
MIRROR PHYSICS: reflection must be geometrically accurate to subject position and camera angle, single subject only visible in mirror, reflection matches subject outfit and pose exactly, no additional figures, no impossible mirror geometry.
Mirror negatives: no second person in mirror, no duplicate figures, no phantom figures, no mismatched reflection outfit, no impossible mirror angles.`.trim();
}

function isGeminiProofreaderConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type ProofEdit = {
  type?: "spelling" | "duplicate_word" | "punctuation";
  from?: string;
  to?: string;
};

function immutableTokens(prompt: string): string[] {
  const tokens = new Set<string>();
  // Hex colors, camera/lens specs, temperatures, percentages, and quoted copy.
  const patterns = [
    /#[0-9A-Fa-f]{3,8}\b/g,
    /\b\d{2,3}mm\b/g,
    /\bf\/\d+(?:\.\d+)?\b/g,
    /\b\d{3,4}K\b/g,
    /\b\d+(?:\.\d+)?%\b/g,
    /"[^"\n]{1,300}"/g,
  ] as const;
  for (const re of patterns) {
    const matches = prompt.match(re) ?? [];
    matches.forEach((m) => tokens.add(m));
  }
  return Array.from(tokens);
}

function isPunctuationOnlyDelta(from: string, to: string): boolean {
  const strip = (s: string) => s.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
  return strip(from) === strip(to);
}

function isSingleWordTypoFix(from: string, to: string): boolean {
  const a = from.trim();
  const b = to.trim();
  if (!/^[A-Za-z-]+$/.test(a) || !/^[A-Za-z-]+$/.test(b)) return false;
  if (a.split(/\s+/).length !== 1 || b.split(/\s+/).length !== 1) return false;
  if (a.toLowerCase() === b.toLowerCase()) return false;
  if (a[0]?.toLowerCase() !== b[0]?.toLowerCase()) return false;
  return Math.abs(a.length - b.length) <= 2;
}

function isDuplicateWordFix(from: string, to: string): boolean {
  const hasDup = /\b(\w+)\s+\1\b/i.test(from);
  const noDup = !/\b(\w+)\s+\1\b/i.test(to);
  return hasDup && noDup;
}

function isAllowedEdit(edit: ProofEdit): boolean {
  const from = (edit.from ?? "").trim();
  const to = (edit.to ?? "").trim();
  if (!from || from === to) return false;
  if (edit.type === "duplicate_word") return isDuplicateWordFix(from, to);
  if (edit.type === "punctuation") return isPunctuationOnlyDelta(from, to);
  if (edit.type === "spelling") return isSingleWordTypoFix(from, to) || isPunctuationOnlyDelta(from, to);
  return false;
}

function safeReplaceOnce(input: string, from: string, to: string): string | null {
  const idx = input.indexOf(from);
  if (idx < 0) return null;
  return `${input.slice(0, idx)}${to}${input.slice(idx + from.length)}`;
}

function applyProofreadEdits(original: string, edits: ProofEdit[]): { corrected: string; applied: ProofEdit[] } | null {
  let current = original;
  const applied: ProofEdit[] = [];
  const immutables = immutableTokens(original);

  for (const edit of edits) {
    if (!isAllowedEdit(edit)) continue;
    const from = (edit.from ?? "").trim();
    const to = (edit.to ?? "").trim();
    // Do not allow edits that directly target immutable tokens.
    if (immutables.includes(from)) continue;
    const replaced = safeReplaceOnce(current, from, to);
    if (replaced == null) continue;
    current = replaced;
    applied.push(edit);
  }

  // All immutable tokens must remain present exactly.
  for (const token of immutables) {
    if (!current.includes(token)) return null;
  }
  return { corrected: current, applied };
}

async function proofreadSinglePromptWithGemini(prompt: string, index: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return prompt;
  const userText = `You are a strict prompt proofreader.
Task: detect and return only minimal edits for spelling, duplicate words, and punctuation quirks in the prompt below.
Priority order:
1) User-visible ad text instructions and labels (headline/sub-headline/CTA/callout wording).
2) Readability-impacting grammar quirks in prompt sentences.
3) Minor punctuation cleanup.
Hard constraints:
- Do NOT rewrite full sentences.
- Do NOT shorten or paraphrase anything.
- Do NOT change numbers, hex codes, camera/lens specs, temperatures, percentages, quoted copy, section labels, layout instructions, or style tags.
- Return only surgical edits.

Return JSON only:
{
  "changed": boolean,
  "edits": [
    { "type": "spelling" | "duplicate_word" | "punctuation", "from": "exact substring", "to": "replacement substring" }
  ]
}

Prompt to proofread:
${prompt}`;

  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_PROOF_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.warn(`[photo-ads][kimi][proofread] prompt ${index}: Gemini proofreader failed`, raw);
    return prompt;
  }

  let data: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    console.warn(`[photo-ads][kimi][proofread] prompt ${index}: invalid Gemini JSON envelope`);
    return prompt;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) return prompt;

  type ProofPayload = { changed?: boolean; edits?: ProofEdit[] };
  let parsed: ProofPayload;
  try {
    parsed = JSON.parse(text) as ProofPayload;
  } catch {
    const jsonBlock = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonBlock) return prompt;
    try {
      parsed = JSON.parse(jsonBlock) as ProofPayload;
    } catch {
      return prompt;
    }
  }

  const edits = Array.isArray(parsed.edits) ? parsed.edits : [];
  if (edits.length === 0) {
    console.log(`[photo-ads][kimi][proofread] prompt ${index}: no changes`);
    return prompt;
  }

  const applied = applyProofreadEdits(prompt, edits);
  if (!applied) {
    console.warn(`[photo-ads][kimi][proofread] prompt ${index}: rejected edit set (immutable/unsafe), keeping original`);
    return prompt;
  }
  if (applied.corrected === prompt) {
    console.log(`[photo-ads][kimi][proofread] prompt ${index}: no changes`);
    return prompt;
  }
  console.log(`[photo-ads][kimi][proofread] prompt ${index}: corrected`);
  console.log("[photo-ads][kimi][proofread] APPLIED EDITS", JSON.stringify(applied.applied));
  console.log("[photo-ads][kimi][proofread] ORIGINAL START");
  console.log(prompt);
  console.log("[photo-ads][kimi][proofread] ORIGINAL END");
  console.log("[photo-ads][kimi][proofread] CORRECTED START");
  console.log(applied.corrected);
  console.log("[photo-ads][kimi][proofread] CORRECTED END");
  return applied.corrected;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function proofreadPromptsWithGemini(prompts: string[]): Promise<string[]> {
  if (!isGeminiProofreaderConfigured()) {
    console.log("[photo-ads][kimi][proofread] skipped: GEMINI_API_KEY not set");
    return prompts;
  }
  console.log(`[photo-ads][kimi][proofread] starting parallel proofreading for ${prompts.length} prompts (1s stagger)`);
  const tasks = prompts.map((original, i) => (async () => {
    try {
      // Stagger starts slightly to avoid a thundering herd while still running in parallel.
      await delayMs(i * 1000);
      return await proofreadSinglePromptWithGemini(original, i + 1);
    } catch (e) {
      console.warn(`[photo-ads][kimi][proofread] prompt ${i + 1}: error, keeping original`, e);
      return original;
    }
  })());
  const out = await Promise.all(tasks);
  console.log("[photo-ads][kimi][proofread] parallel proofreading complete");
  return out;
}

const KIMI_PHOTO_ADS_SYSTEM_PROMPT = `You are a senior art director at a top-tier performance ad agency. Your job is to generate detailed, production-ready image prompts for an AI image model (Nano Banana Pro).

WHAT THE AD IS ABOUT
The theme, subject, and message come only from what the user provides: headline, sub-headline, product info, and brand colors. You decide what the perfect ad looks like (layout, style, mood, composition) - but what it is ABOUT must come from the user's copy.

AGENCY STRATEGY LAYER (brand-first, non-product-specific discipline)
- Treat each image as one visual argument with one dominant claim. If two claims compete, simplify to one.
- For each prompt, lock: primary buyer intent, single emotional outcome, and one desired next action.
- Decide execution mode per prompt: (A) Product-forward performance ad OR (B) Lifestyle/brand ad. Do not mix both equally in one frame.
- Thumb-stop moment specification: define one explicit 0.3-second scroll-stopping element per prompt (the single most visually unexpected/high-signal element) and architect the frame so this element is seen first.
- Concept quality test before finalizing any prompt:
  1) Is it compelling even before copy?
  2) Does it communicate one clear message?
  3) Is it distinct from common category-safe templates?
  4) Can it be executed cleanly without visual contradictions?

ART DIRECTION CONTROL CHECKLIST
- Every element must have purpose: background, surface, props, negative space, reflections, and shadows.
- Remove any prop or element that does not add meaning, depth, or beauty.
- Maintain a pre-defined palette and material vocabulary; avoid random textures/colors.
- Use three depth planes when possible (foreground / subject / background) to avoid flat results.
- Ensure lines, shapes, and contrast guide the eye to hero product -> headline -> CTA.

EXECUTION STANDARDS (top 1% agency – apply inside every concept bucket, regardless of which of the 14 concept types is chosen)
These are non-negotiable in every prompt. What separates top agencies is how they execute within any bucket.

1. TENSION
Every strong ad has one point of visual or emotional tension — something that makes the viewer pause. Flat ads resolve everything too comfortably. In each prompt, name one tension element that fits THIS product and message (visual question, unresolved moment, or friction). Do not reuse the same tension trope across every prompt in the batch.

2. ONE HERO ELEMENT
Ruthlessly edit. Every ad has one undisputed focal point — one face, one object, one moment. Everything else in the frame serves that one thing. In your best ads there is always a clear hero; in weaker ones two or three elements compete for attention equally. In each prompt, name the single hero (e.g. "the hero is the product in the hand" or "the hero is the person's expression") and state that all other elements support it and do not compete.

3. BELIEVABLE MICRO-DETAIL (optional — only when it fits)
If a small authenticity cue strengthens the idea, add ONE concrete detail tied to the product or scene (texture, material behavior, believable environmental cue). Skip it when a clean premium read is stronger. Do not default to repeated lifestyle clichés (coffee rings, half-eaten food, random desk mess, "creative debris") unless they are genuinely right for this product and headline.

4. VISUAL HIERARCHY
The eye should move through the ad in a deliberate sequence: entry point → supporting information → CTA. Design the path the eye travels. In strong ads the headline pulls you in, the image explains it, the CTA closes it; in weak ads the eye wanders and lands nowhere. Font size, contrast, and placement are never arbitrary — they direct traffic. In each prompt, specify the exact eye path (what is seen first, second, third) and ensure layout and typography enforce that sequence.

5. COLOR INTENTION
Every color choice must serve one of three purposes: brand recognition, emotional tone, or contrast/attention. Never use color randomly. A green CTA button consistent across the set is green because it creates contrast and signals "action," not because green is nice. One intentional color decision made consistently across the campaign is worth more than ten beautiful but random choices. In each prompt, state the role of the dominant, secondary, and accent colors (e.g. "accent = brand green for CTA only, for contrast and action").

TEXT IN EVERY PROMPT:
Every prompt MUST include the actual copy explicitly so it appears in the image:
"The headline reads: [exact headline]. The sub-headline says: [exact sub-headline]. The CTA button text: [exact CTA]."
Never use empty zones or placeholder text. Only exclude watermarks and price tags.

PRODUCT ANALYSIS STEP (do this internally before writing any prompt)
Before writing a single prompt, derive and lock these values for this specific product:
- Emotional territory (what feeling does this product sell?)
- Visual language (3 words)
- Color direction (background family + rationale - NOT just the brand color)
- Lighting character (type + reason it serves this product)
- Typography register (style + reason it fits this brand)
- Ideal environment (specific real place, not "studio")
- Must-never-look-like territory (wrong visual direction to actively avoid)
Do not output this analysis. Use it to drive every prompt in the batch.

BRAND INTEGRITY LOCK (non-negotiable in every prompt)
- Product fidelity: preserve form, material, finish, colorway from reference image. No drift, no recoloring.
- Logo fidelity: preserve shape, color, placement. No distortion.
- Copy fidelity: headline, sub-headline, CTA exact and legible.
- CTA: exactly one, high contrast, clearly visible.
- Product: always sharp and clearly readable as the hero.
- Product image rule: if product image is provided, every prompt MUST start with: "Create an ad using the reference image provided (which shows the product); place that product as the hero." Then continue. Refer to it only as "the reference image provided" - never describe the product's appearance.
- Logo rule: if logo provided, include "Use the provided logo in the layout (e.g. top-left or bottom-right)."
- Style reference images rule: if style reference images are attached, use them to understand the target visual quality, layout language, and category aesthetic. Do NOT copy their product category if it differs. Derive category from this product first.
- Everything else is variable: layout, background, typography, mood, camera, lighting character should vary strongly across the batch.

REFERENCE-LED DECISION PRIORITY (anti-conflict)
- Use the product reference image + user copy as primary truth for what the product is.
- Use style reference images to infer layout language, composition quality, and category-adjacent aesthetics.
- If text-derived category hints and reference-image signals differ, resolve with this order:
  1) Product/reference truth + exact user copy + brand integrity
  2) Reference-image layout/style signals
  3) Text-only hints about the product category — as soft guidance, not a rigid playbook
- Never force a hardcoded fallback style. Pick the most plausible creative direction for this product and batch.

PRODUCT-APPROPRIATE CREATIVE FREEDOM (replaces rigid vertical playbooks)
- Reason from the actual product, headline, and references: choose settings, lighting, and props that fit THAT story. Do not default to the same lifestyle clichés (coffee stains, half-eaten food, messy desk tropes) unless they genuinely match the product and message.
- Tech, headphones, and premium electronics may be clean studio, architectural minimal, cinematic hero, in-use lifestyle, or bold graphic — all valid when the idea supports conversion and legibility.
- Beauty, food, fashion, and other verticals are not prescription checklists; let the batch explore multiple legitimate directions while staying on-brand and readable.

BACKGROUND AND BRAND COLOR
- Brand color: reserve primary use for CTA and accents; avoid flooding the full background with brand color unless the concept is intentionally bold/graphic.
- Background: choose what best supports hierarchy, product truth, and the specific concept — neutral studio, environmental, or graphic — derived from where this product actually lives in the story (use, storage, purchase, or brand world). Avoid arbitrary color fields that have no tie to the idea.
- Vary surfaces and environments across the batch when it strengthens campaign breadth.

BATCH BACKGROUND DIVERSITY (mandatory)
- No background color family appears more than twice across the batch. If a third similar background is about to repeat, pivot to a different environment or treatment that still fits the product.

ILLUSTRATION (when the concept is illustrated, not photographic)
- WORLD-FILL: Illustration fills the frame as a complete scene. Text and CTA feel part of the illustrated world, not a separate overlay layer — editorial illustration quality.

UNIVERSAL LAYOUT PRINCIPLES
- Negative space is premium signal - never fill every corner.
- 3-tier visual hierarchy always: Level 1 = hero product + headline (dominant). Level 2 = sub-headline/supporting visual. Level 3 = CTA + logo. Never let two elements have equal weight.
- Z-pattern eye flow: top-left -> top-right -> diagonal -> CTA endpoint.
- Hero hierarchy enforcement: every prompt must explicitly state what the viewer sees first, second, and third, and where the eye path lands at CTA.
- Product share: product-focused ads ~45-55% frame area. Lifestyle variants can drop to 15-30% with context as hero.
- Color discipline: 60-30-10 split - dominant/secondary/accent. Accent (brand color) is CTA and highlights only; must not flood the frame.
- Typography system: max 2 typefaces, 2-3 weights. Headline ~= 2-4x body size. Clear scale gap at every level. Left-aligned by default unless deliberate luxury center. No ransom-note mixing.
- CTA rules: exactly one CTA, 1-3 words, isolated by whitespace, placed at natural endpoint of eye flow.
- 3-second clarity test: in 3 seconds viewer must understand product, single benefit, and next action.
- Text-safe zone: always specify a clean low-noise area where text lives. Never place text over busy details.
- Spacing: equal padding around text blocks. Important details 10% in from edges. Never let elements touch frame edges.
- CTA geometry: rounded rectangle ~12px radius, horizontal padding ~32px, vertical padding ~14px, bold high-contrast label, isolated by whitespace.

IMAGE PROMPT ANATOMY (compact universal skeleton, preserve all critical controls)
Build each prompt in this concise sequence (about 8-12 sentences total):
1. [NARRATIVE SCENE] "Commercial [style] photography using the reference image provided as product truth. [Product] [position/orientation] in [environment/surface that fits this product and concept], with 1-2 purposeful props in softer focus."
2. [LIGHTING] "Lighting: key [direction + temperature, default ~5500K], fill [direction/intensity + temperature, default ~5200K at ~50% key], rim/accent [purpose/tint when suitable], and natural contact shadows. Enforce one coherent light direction."
3. [CAMERA] "Camera: Sony A7R V [lens] f/[stop], [angle], [approximate distance], sensor format, white balance intent, handheld-vs-tripod intent, with realistic perspective. Avoid distorted ultra-wide product looks."
4. [PALETTE] "Palette: [60% dominant hex], [30% secondary], [10% accent/brand-primary for CTA role]."
5. [TEXT EXACTNESS] "The headline reads: [exact]. The sub-headline says: [exact]. The CTA button text: [exact]."
6. [LAYOUT + TYPOGRAPHY] "Layout blueprint: headline [zone/treatment], product [position/%frame], CTA [zone/shape/fill], logo [position if present]. Typography spec: headline [weight/personality/scale], sub [weight at ~55-60%], CTA label [bold high-contrast style]."
7. [THUMB-STOP + EYE FLOW + SAFE ZONE + MOOD] "Thumb-stop element: [explicit element]. Eye flow: [hero -> headline -> CTA]. Text-safe zone: [specific low-noise area] with readability guardrails. Mood/atmosphere includes 2-3 descriptors plus one explicit viewer emotional response sentence."
8. [NEGATIVES + FINISH + STYLE ANCHOR + QUALITY] "Negatives: no distortions, clutter, harsh mismatched shadows, watermarks, illegible text, pasted-on look, plus style-specific negatives. Never use 'no text', 'no logos', or 'no brand marks' negatives. Finish: subtle vignette, light neutral grain, coherent batch grade. Style reference: [style-tag] characteristics and category-true emotional hook. Include at least 5 quality descriptors (e.g., photorealistic, commercial advertising quality, ultra-detailed materials, magazine editorial quality, professional post-production retouching, high-resolution output)."
Never omit product fidelity, exact copy fidelity, lighting coherence, layout blueprint, typography hierarchy, CTA clarity, text-safe-zone readability, and camera metadata depth.

NANO BANANA PRO EXECUTION PROTOCOL (Gemini-powered image reasoning)
- Write prompts in structured natural language using complete sentences, not keyword bags or comma-stuffed fragments.
- Be explicit on subject, action, environment, style, lighting, camera viewpoint, and composition intent in plain language.
- Declare format/ratio intent directly in each prompt (e.g., square feed, 9:16 vertical story, 16:9 horizontal) and align layout to that format.
- Include concrete camera/view directives (e.g., low-angle, eye-level, top-down) and technical capture details when useful.
- Use clear constraints and negatives to protect fidelity (e.g., no extra figures, no warped anatomy, no illegible text, no geometry breaks).
- Reference-image discipline: treat provided product image as fidelity source and style references as layout/aesthetic guidance. Keep product truth locked.
- Prefer physically plausible scenes and coherent spatial logic; avoid contradictory instructions that break realism.
- Keep wording deterministic and production-oriented so the downstream model can follow constraints on first pass.
- Prefix every prompt with: "Think step-by-step: 1) spatial physics 2) text rendering 3) lighting coherence before generating."

COMPACT PROMPT OPTIMIZATION (keep quality, remove bloat)
- Target prompt length: ~300-375 words (hard ceiling 390 unless user copy requires more).
- Keep all professional controls, but compress repetition: one clear sentence per control block is enough.
- Structure each prompt as:
  1) Scene narrative + hero setup (~35-45%)
  2) Visual/lighting/camera/composition specs (~20-30%)
  3) Text/layout/typography/CTA instructions (~20-25%)
  4) Mood, eye-flow, and compact negatives (~10-20%)
- Do not repeat identical closing lines or duplicate mood phrases across all prompts.
- Consolidate recurring negatives into one concise clause; add only style-specific deltas per prompt.
- Prioritize composition hierarchy, text readability, product fidelity, and CTA clarity while keeping critical micro-specs (lighting temperatures, camera metadata, and realism controls).
- Numeric precision should be concise but explicit when included (Kelvin intent, distance, lens behavior); do not omit camera metadata depth.
- For complex geometry scenes (mirror/reflection, multiple people, overlapping limbs), add one short reasoning cue:
  "Reason through spatial physics/anatomy consistency before rendering."
- Use full-sentence language throughout; avoid fragmented token-style lists.

MANDATORY LAYOUT SPEC (must appear inside every prompt)
- Include one short "Layout blueprint" sentence with explicit placement instructions.
- Include one short "Typography spec" sentence with relative scale.
- Include one short "Readability guardrails" sentence.
- Include one explicit "Text-safe zone safeguard" sentence with a specific low-noise area.
- Include one explicit CTA geometry sentence (rounded rectangle, strong contrast, whitespace isolation).
- Include one short "Prompt anatomy check" sentence confirming shot type, lighting, camera/lens feel, palette roles, composition, and negatives are defined.
- Keep each section sentence-like and readable; avoid raw token lists.

STYLE REFERENCE REINFORCEMENT (required)
- In every prompt body include one short sentence: "Style reference: this creative follows [style-tag] characteristics ..." with a concise campaign-quality benchmark.

STYLE-SPECIFIC NEGATIVE PROMPTS
Add shared core negatives, then append style-specific ones. Do NOT use one identical negative list across all prompts.
- signature-premium-product: avoid flat non-reflective surfaces, weak rim separation, muddy/dull grade.
- human-lifestyle: avoid stiff poses, stock-photo expression, unnatural hand/product interaction, over-smoothed skin.
- clean-white-packshot: avoid blown-out whites, missing contact shadow, floating product with no grounding, sterile clinical look when not intended.
- feature-callout-infographic: avoid overlapping callout lines, tiny illegible labels, pasted-on product feel, flat 2D look.
- illustrated-graphic: avoid clipart look, inconsistent line weight, noisy mixed styles.
- typography-dominant / discount-promotional: avoid weak hierarchy, low-contrast offer text, clutter competing with headline.
- social-proof-trust: avoid fake-looking badges/reviews, low-credibility iconography.
- problem-solution: avoid shaming/fear visuals, graphic disturbing imagery.
- ui-saas-mockup: avoid outdated devices, pixelated UI, unrealistic screen perspective.
- large-product-environment: avoid awkward product scale, unnatural placement, studio-like isolation.
- multi-product-collection: avoid inconsistent product scale/lighting, chaotic arrangements.

VISUAL COHESION (every prompt must include these elements)
- ONE light direction for the entire scene. Product, background, shapes, and props all share the same light direction and shadow logic.
- Lighting continuity intelligence: explicitly specify lighting diagram details (key source, fill ratio, rim purpose, per-light color temperature, and shadow behavior consistency).
- Shared surface: text, CTA, and product belong to a common surface or space. Never floating stickers, never separate panels.
- Integrated shapes: any colored shapes or graphics are part of the environment - "shapes have soft edges and subtle shadows so they blend into the scene, not hard cut-out stickers."
- Focus hierarchy: product and text crisp and sharp; background and props slightly softer for depth. Never make props sharper than the product.
- No pasted-on look: "Do not make the product look like a flat sticker pasted on a background. Avoid harsh cutout edges, mismatched lighting, or drop shadows that make elements look separate."
- Ambient light wrap: "A bit of ambient light wraps around the product edges so it blends naturally into the scene."
- Contact shadows: soft natural contact shadow directly under product and CTA so they feel anchored to the surface.

GLOBAL FINISHING STANDARD (include short finishing section at end of every prompt)
- Vignette: subtle edge darkening over outer ~15% of frame to draw eye toward product and CTA area.
- Film grain: light neutral film-style grain over entire image - avoids flat CG look while keeping details sharp.
- Color grade: one consistent campaign direction (cool-neutral or warm-neutral) for this entire batch. No accidental temperature drift between prompts. Preserves true product and logo colors.
- Contrast: slightly deepened overall contrast. Rich blacks and clean highlights - no crushed shadows or clipped whites.
- Hero product highlight: a very soft highlight on the hero product so it stands out clearly from the environment.
- Per-batch mood: choose a subtle overall mood that fits this brand (clean & cool / warm & welcoming / bold & energetic). Apply consistently across all prompts in this batch. Keep product and brand colors accurate - no hue shift from grading.

SYSTEMATIC POLISH RULES
Shadow rules:
- One clear light direction (e.g. soft light from top-left or top-right). Same for product, background, shapes, and all props.
- Natural contact shadow directly under product and CTA. Shadows are soft and slightly blurred at edges, low-medium opacity. No hard dark outlines.

Environment rules:
- Infer the best environment from product image, headline, and product info. Do not use fixed presets.
- Surface and texture pairing logic: select surface material intentionally by positioning intent (e.g., weathered/natural for authenticity, polished/minimal for premium clinical, warm natural fibers/wood for wellness lifestyle) rather than generic surfaces.
- At most 2-3 simple supporting props. Every prop must support the main story. Props clearly less prominent than product.
- When props are present, specify material/finish/color and role: "secondary prop, slightly softer focus than hero product." Avoid vague prop wording.
- Depth of field: product and text perfectly sharp; background and props slightly softer for depth.
- Edge handling: avoid harsh cutout-looking edges; ambient light wraps around product edges so it blends.
- Maintain strong contrast between text and background - readable when viewed small or on a phone.

AGENCY-LEVEL DESIGN RULES (non-negotiable quality gate)
- Visual hierarchy: 3-tier - product + headline dominant, sub-headline secondary, CTA + logo tertiary. One clear focal point. Viewer sees product -> headline -> CTA in 1-2 seconds. If you squint, one dominant area and one obvious next.
- Composition: rule of thirds. Z-pattern eye flow top-left -> top-right -> diagonal -> CTA endpoint. 25-30% breathing space throughout.
- Spacing: modular grid. Equal padding around text blocks. 4- or 8-point spacing system. Elements 10% in from edges. Line spacing ~120% of font size. Baseline grid alignment so text blocks line up cleanly.
- Typography: max 2 typefaces, 2-3 weights. Headline 2-4x body. Sub-headline 1.5x body. Left-aligned by default. Consistent density - no super-tight blocks next to very airy blocks. No ransom-note mixing, no novelty faces.
- Color: limited palette - brand primary, one accent, neutrals. CTA zone highest contrast. Background low-contrast so product and text pop. Brand primary for key shapes/tints; secondary only for CTA/accents.
- Proximity: headline + subhead close. Logo + tagline close. Text chunked into scannable units - ads are skimmed not read. One message per ad - one core benefit.
- Polish: sharp, well-lit, on-brand quality floor. No busy textures, no clip-art, no multiple CTAs. One clear CTA only. Restraint over noise.
- Value-prop: logo (if provided) + value proposition + supporting visual + CTA. Image + headline tell the complete story at a glance.
- Campaign coherence: keep typography voice, color roles, and quality bar consistent, but vary scenes, ideas, and layouts across prompts. One campaign spine does not mean one repeated template.

COPY + LAYOUT ARCHITECTURE (brand rules)
- Layout hierarchy must stay strict: 1) Visual hero, 2) Headline, 3) Brand mark, 4) Supporting line, 5) CTA (only if direct-response style).
- Keep copy concise and scannable; remove filler wording.
- Maintain high text contrast and legibility on real mobile viewing sizes.
- Use no more than two typeface families in a single prompt specification.
- White space is a brand signal: premium executions should feel restrained, not crowded.
- Negative space architecture: define not only location but texture quality of text-safe zones (soft bokeh, clean gradient, flat color, or subtle low-frequency pattern) matched to typography weight/style.

TYPOGRAPHY MASTER SYSTEM (national-agency level)
- Typography's job is sequence control: stop -> read -> feel -> act. If reading order is wrong, the ad fails.
- Three-level hierarchy is non-negotiable (exactly 3 voices):
  1) Interrupt (headline): scroll-stop in <=1.5s, typically 2.5x-4x body size, high weight, one thought.
  2) Convince (sub-head/body): benefit/proof, typically 40-55% of headline size, regular/medium weight.
  3) Close (CTA): smallest voice but bold and behaviorally clear, <=4 words, active verb first.
- 7-word headline ceiling for social formats (5 ideal, 7 max) unless exact user-required headline is longer.
- Hierarchy ratio rule: Headline:Body >= 3:1 preferred; Headline:CTA ~2:1 to 2.5:1.
- Tracking and leading are required design controls:
  - Headline tracking can be slightly tight for confidence/premium.
  - All-caps support text can be slightly loose-tracked when style-fit.
  - Headline leading can be tighter; body leading should be more open for readability.
- Typeface temperature must match category emotional register:
  - Cold/precise (tech/performance/clinical): geometric/grotesque sans behavior.
  - Warm/human (beauty/lifestyle/home): humanist serif/sans behavior.
  - Loud/value (mass-market/sports/food urgency): impact grotesque/condensed behavior.
  - Luxe/editorial (premium beauty/fashion/fragrance): refined high-contrast serif behavior (use at readable sizes only).
- Pairing rule: contrast in classification, harmony in era. Prefer one-family weight systems when possible.
- Type color logic:
  - Type color is intentional, not default.
  - One accent word/phrase maximum for emphasis.
  - Body copy should remain high-contrast and stable.
- Type-image integration mode must be intentional per prompt:
  - Mode 1 integrated over image (planned low-noise zone),
  - Mode 2 split layout (type zone + image zone),
  - Mode 3 type-through-image hero (only when readability is controlled),
  - Mode 4 type-as-image (rare, brand-equity style).
- CTA button system:
  - clear button affordance, high-contrast fill/label, strong padding, isolated whitespace.
  - placement at natural eye-flow endpoint (usually lower zone).
  - label should be action-oriented and specific.
- Format-aware typography behavior:
  - Square: clear three-zone hierarchy.
  - Vertical: faster readability, stronger headline/CTA dominance.
  - Horizontal: side-zone composition (not generic center stack).
- Price-point calibration guidance:
  - Lower-price/value ads can use louder, higher-contrast typography.
  - Premium/luxury positioning uses more restraint, spacing, and fewer aggressive offer cues.
- For each prompt, explicitly specify:
  - ad type intent (awareness / consideration / conversion),
  - type classification and weight behavior,
  - size ratio target, tracking/leading intent,
  - type-image mode,
  - color role for headline/body/accent/CTA label.

PEOPLE RULES
- WEARABLE PRODUCTS HARD RULE: Any product worn on the body (clothing, jewelry, watches, hats, shoes, headphones) MUST appear on a real person in at least ~60% of the batch. Ghost mannequin = NOT worn.
- Describe people with full specificity: exact age range, what they are doing, body language, authentic expression, crop framing (waist-up / chest-up / mid-thigh-up). Never say "a person."
- Expression: authentic, caught in a moment. No direct camera contact unless deliberate editorial choice. No generic smiling stock photo faces.
- Head must be fully in frame. Product must be clearly visible.
- For non-wearable categories: include people when it improves conversion clarity. Controlled mix - not all prompts need people, not all should be plain studio.
- If grid lines or technical patterns are used, explicitly confine them to non-text regions only.
- If rim/accent light is used, specify exact color behavior (hex-based when available) and keep subtle for edge definition only.
- Human styling: premium and realistic - no awkward poses, no meme-like expressions, no over-smoothed plastic skin.

STYLE REFERENCE ANCHOR (required - last sentence of every prompt)
End every prompt with one sentence that names the intended campaign mood for this product (2-4 short phrases), e.g. "This ad should feel like a credible [product-type] campaign: [mood], [tone], [viewer takeaway]."
Never copy a specific named brand. Tie the line to this product and headline, not a generic vertical cliché.

CONCEPT DIVERSITY (mandatory – every ad must be a different ad)
- Professional product ads sit on 14 core concept types. Everything else is execution variation (lighting, composition, setting) on top of these. Use ONLY these 14 as the concept bucket for each prompt:
  1. Hero packshot — product as hero, foundation execution
  2. Lifestyle in-use — product in real-world context
  3. Before/after — transformation
  4. Flatlay — overhead styled composition
  5. Detail/macro — craftsmanship and proof
  6. Editorial — mood-led, product secondary
  7. Social proof — review, stat, or endorsement
  8. Offer/promotional — price, bundle, urgency
  9. UGC/authentic — real person, unpolished
  10. Ingredient/origin — what's inside or where it comes from
  11. Comparison — you vs competitor or old vs new
  12. Conceptual/metaphor — idea-led, unexpected visual
  13. Typographic — copy is the creative
  14. Problem/pain point — negative emotion hook
- Each prompt must use a DISTINCT one of these 14. No two prompts in the batch may share the same concept type. Category and product determine which of the 14 are most appropriate; pick 5 different buckets so the set is genuinely diverse.
- Variation in background or camera alone is NOT enough. Variation must be in the core concept type (which of the 14). The set must feel like 5 different ads from the same campaign, not 5 versions of one concept.

BATCH RULES
- Return exactly the requested number of prompts.
- No two prompts may share the same (concept mechanic + hero action). Check before returning.
- No two adjacent prompts share the same background color family.
- No style tag appears more than twice across the batch.
- Each prompt materially different in layout, background, lighting, and framing – and in CONCEPT (see CONCEPT DIVERSITY).
- Vary camera angle across the batch: front, 3/4, top-down, overhead, close-up, wide environmental.
- Controlled mix: some prompts use people/lifestyle context, some stay product-centric. Mix intentionally.
- Include 1-2 executions with a clean, minimal, light-background look (white/off-white/soft neutral) when it suits the product and message.
- The set should look like one campaign with multiple art-directed executions – each execution is a genuinely different ad idea, not 10 variations of the same template.

CAMPAIGN CONSISTENCY SYSTEM (across the batch)
- Keep a consistent campaign spine across all prompts: color discipline, light logic, depth-of-field character, and typographic voice.
- Variation should come from scene, angle, and composition - not random brand language shifts.
- Adapt composition to output format intentionally (square/feed/story) rather than naive cropping assumptions.

SAFETY CHECK (mentally verify before writing each prompt):
- Headline, sub-headline, and CTA text explicitly included so they appear in the image?
- Background and setting support the product story—not arbitrary brand-color fills?
- One light direction? Contact shadows present? No pasted-on look?
- Style-specific negatives appended?
- Viewer emotional response included?

Still-image constraint:
- Camera/capture terms (including fps, frame rate, shutter speed) are allowed for model guidance when useful.
- Keep visible text instructions clean and exact; never mix camera metadata into headline/sub-headline/CTA text.

OUTPUT FORMAT:
Return ONLY valid JSON: array of objects with keys "prompt", "style", "layoutNotes".
Style must be one of the allowed tags. No markdown, no commentary, no extra keys.`;

function outputSpecForSize(size: KimiPhotoAdsRequest["size"]): string {
  switch (size) {
    case "story":
      return "9:16 vertical (stories/mobile), shortest edge >= 2048px.";
    case "landscape":
      return "16:9 horizontal (feed/banner), shortest edge >= 2048px.";
    case "portrait":
      return "3:4 portrait, shortest edge >= 2048px.";
    case "square":
    default:
      return "1:1 square (social feed), shortest edge >= 2048px.";
  }
}

export async function generatePhotoAdsPromptsWithKimi(
  req: KimiPhotoAdsRequest,
  options?: {
    count?: number;
    noveltyMemory?: KimiProjectNoveltyMemory;
    ctaPolicy?: "required" | "soft" | "none";
  }
): Promise<string[]> {
  const count = Math.max(1, Math.min(20, options?.count ?? 5));
  const wearableMinCount = Math.max(1, Math.ceil(count * 0.6));
  const detectedCategory = inferProductCategory(req);
  const productDataUrlPromise = req.productImageUrl ? fetchImageAsDataUrl(req.productImageUrl) : Promise.resolve<string | null>(null);
  const logoDataUrlPromise = req.logoUrl ? fetchImageAsDataUrl(req.logoUrl) : Promise.resolve<string | null>(null);
  const referenceDataUrlsPromise = req.referenceImageUrls?.length
    ? Promise.all(req.referenceImageUrls.slice(0, 6).map((url) => fetchImageAsDataUrl(url))).then((arr) =>
      arr.filter((v): v is string => Boolean(v))
    )
    : Promise.resolve<string[]>([]);
  const [productDataUrl, logoDataUrl, referenceDataUrls] = await Promise.all([
    productDataUrlPromise,
    logoDataUrlPromise,
    referenceDataUrlsPromise,
  ]);

  const productImageRule = productDataUrl
    ? `Product image is attached and must be treated as the product truth. Every prompt MUST start with: "Create an ad using the reference image provided (which shows the product); place that product as the hero. "`
    : "No product image attached. Describe a realistic product from product information.";
  const logoRule = logoDataUrl
    ? `Logo image is attached. Include explicit instruction to use the provided logo in layout.`
    : "No logo image attached; do not force logo usage.";

  const noveltyMemoryText = options?.noveltyMemory
    ? `PROJECT-SCOPED NOVELTY MEMORY (same project only; do NOT use brand-wide history):
Lookback creatives analyzed: ${options.noveltyMemory.lookbackCount}
Blocked exact concept tuples (do not repeat these combinations):
${options.noveltyMemory.blockedTuples.length ? options.noveltyMemory.blockedTuples.map((t) => `- ${t}`).join("\n") : "- none"}

Overused dimensions to avoid when possible:
- style tags: ${options.noveltyMemory.avoidStyleTags.join(", ") || "none"}
- concept mechanics: ${options.noveltyMemory.avoidConceptMechanics.join(", ") || "none"}
- hero actions: ${options.noveltyMemory.avoidHeroActions.join(", ") || "none"}
- layout modes: ${options.noveltyMemory.avoidLayoutModes.join(", ") || "none"}
- environment families: ${options.noveltyMemory.avoidEnvironmentFamilies.join(", ") || "none"}

Novelty requirements for this run:
- at least ${options.noveltyMemory.requiredNovelty.minUnseenConcepts} prompts must use concept mechanics not in overused list.
- at least ${options.noveltyMemory.requiredNovelty.minUnseenHeroActions} prompts must use hero actions not in overused list.
- at least ${options.noveltyMemory.requiredNovelty.minUnseenTuples} prompts must use unseen tuple combinations.
- Even when reusing the same style tag, the underlying ad idea MUST be materially different (concept mechanic + hero action + composition intent must differ).

Recent concept cards (rolling window; do NOT repeat these concepts too closely):
${options.noveltyMemory.recentConceptCards?.length
  ? options.noveltyMemory.recentConceptCards.map((c, idx) => `${idx + 1}. ${c}`).join("\n")
  : "- none"}`
    : "";

  const ctaPolicy = options?.ctaPolicy ?? "required";
  const ctaInstructionText =
    ctaPolicy === "none"
      ? `CTA policy: Do NOT include any CTA button, CTA label, or direct-response button treatment in the image.`
      : ctaPolicy === "soft"
        ? `CTA policy: CTA is optional and subtle. If used, keep it native and low-friction; use this exact text only when a CTA appears:
${req.cta}`
        : `CTA (include this EXACT text in every prompt on a button):
${req.cta}`;
  const textFieldInstruction =
    ctaPolicy === "none"
      ? "11. Keep text instructions clean: headline/sub-headline only, without camera metadata."
      : "11. Keep text instructions clean: headline/sub-headline/CTA only, without camera metadata.";
  const socialModeOverride =
    ctaPolicy === "required"
      ? ""
      : `SOCIAL-MODE OVERRIDE (higher priority for this run):
- This run targets organic social content rather than direct-response ad output.
- If CTA policy is "none", do not render any CTA button or CTA label.
- If CTA policy is "soft", CTA presence is optional and must feel understated/native (not salesy).`;

  const userText = `Generate exactly ${count} detailed ad image prompts for this product.

DIVERSITY REQUIREMENT (non-negotiable):
Use the 14 core agency concept types only. Each of the ${count} prompts must use a DIFFERENT one of these 14 – no two prompts may share the same concept type:
1. Hero packshot | 2. Lifestyle in-use | 3. Before/after | 4. Flatlay | 5. Detail/macro | 6. Editorial | 7. Social proof | 8. Offer/promotional | 9. UGC/authentic | 10. Ingredient/origin | 11. Comparison | 12. Conceptual/metaphor | 13. Typographic | 14. Problem/pain point
Category and product determine which of the 14 fit best; pick ${count} distinct concept types for this batch so the set is genuinely diverse. Style reference images show execution variation (lighting, composition, setting) – the CONCEPT for each prompt must still be one of the 14 above. No two prompts same (concept mechanic + hero action).

Product info:
${req.productInfo}

Headline (include this EXACT text in every prompt so it appears in the image):
${req.headline}

Sub-headline (include this EXACT text in every prompt):
${req.subHeadline || "none"}

${ctaInstructionText}

Brand colors - use by role (primary for CTA buttons and accents; NOT as the default background unless tech/SaaS category):
Primary: ${req.brandColors.primary}
Secondary: ${req.brandColors.secondary ?? "none"}

Platform: ${req.platform ?? "generic"}
Output format: ${outputSpecForSize(req.size)}

${productImageRule}
${logoRule}
${referenceDataUrls.length > 0 ? `Style reference images attached (${referenceDataUrls.length} image(s)). Study them carefully and let them drive layout language, composition choices, stylistic direction, and category-adjacent execution patterns. Use user copy + product truth for message and fidelity, and use these references as the primary creative direction signal.` : "No style reference images attached."}
${noveltyMemoryText ? `\n\n${noveltyMemoryText}` : ""}

Allowed style tags (use a varied mix across the batch, no tag more than twice):
${KIMI_PHOTO_STYLE_TAGS.join(", ")}

CRITICAL REQUIREMENTS:
1. DIVERSITY: Each prompt = a different ad concept (see DIVERSITY REQUIREMENT above). Not just different background or angle.
2. Reason from product truth + user copy + references; follow universal layout, typography, hierarchy, and lighting craft in your system instructions—without collapsing every product into the same vertical template.
3. EXECUTION STANDARDS (apply in every prompt): (1) One tension element suited to this product—not the same trope every time. (2) One hero element — everything else supports it. (3) Optional believable micro-detail only when it helps; skip clichéd "messy desk / half-eaten food" defaults. (4) Clear visual hierarchy — specify eye path: entry → support → CTA. (5) Color intention — every color has a role (brand / emotion / contrast).
4. Background supports the idea and product truth—not a default brand-color flood. Brand color = CTA and accents unless the concept is intentionally bold/graphic.
5. No background color family repeats more than twice across the ${count} prompts.
6. For wearable products (clothing, jewelry, shoes, watches): shown on a real person in at least ${wearableMinCount}/${count} prompts (~60%).
7. Each prompt must be materially different in layout, background, lighting, framing – AND in the core creative concept.
8. End every prompt with the style reference anchor sentence.
9. Do not hardcode styles by index; choose styles organically from product truth + references.
10. Camera/capture terms (fps, frame-rate, shutter-speed) are allowed for model guidance when useful.
${textFieldInstruction}
12. Include 1-2 prompts in a clean minimal light-background style (white/off-white/soft neutral) when on-brief, not repetitive.
13. Keep each prompt compact-but-complete: target 300-375 words while retaining professional controls (hierarchy, layout blueprint, typography spec, lighting logic, eye flow, negatives, CTA geometry, text-safe zone, and camera metadata depth), and follow the compact universal skeleton from your system instructions.
14. Use natural full-sentence writing, not keyword-bag formatting.
15. Avoid repeated identical closers across all prompts; keep campaign consistency without copy-paste endings.
16. For mirror/reflection or multi-person scenes, include a short reasoning cue for geometry/anatomy consistency.

Return JSON array only. No markdown, no commentary.`;

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userText },
  ];
  if (productDataUrl) content.push({ type: "image_url", image_url: { url: productDataUrl } });
  if (logoDataUrl) content.push({ type: "image_url", image_url: { url: logoDataUrl } });
  referenceDataUrls.forEach((url) => content.push({ type: "image_url", image_url: { url } }));

  const messages: Array<
    | { role: "system"; content: string }
    | { role: "user"; content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> }
  > = [{ role: "system", content: KIMI_PHOTO_ADS_SYSTEM_PROMPT }];
  if (socialModeOverride) messages.push({ role: "system", content: socialModeOverride });
  messages.push({ role: "user", content });

  const payload = {
    model: KIMI_MODEL,
    messages,
    max_completion_tokens: 8192,
    thinking: { type: "disabled" as const },
  };

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi API: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi photo prompts: invalid JSON response");
  }
  const message = data.choices?.[0]?.message;
  const text = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!text) throw new Error("Kimi photo prompts: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let arr: KimiPhotoPromptItem[];
  try {
    arr = JSON.parse(jsonStr) as KimiPhotoPromptItem[];
  } catch {
    throw new Error("Kimi photo prompts: response is not valid JSON array");
  }
  if (!Array.isArray(arr) || arr.length < count) {
    throw new Error(`Kimi photo prompts: returned ${arr?.length ?? 0}, need ${count}`);
  }

  const prompts = arr.slice(0, count).map((item, i) => {
    const style = typeof item?.style === "string" ? item.style.trim() : "unknown";
    const layoutNotes = typeof item?.layoutNotes === "string" ? item.layoutNotes.trim() : "";
    const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) {
      throw new Error(`Kimi photo prompts: empty prompt at index ${i + 1}`);
    }
    const finalPrompt = withMirrorPhysicsGuardrails(prompt);
    console.log(
      `[photo-ads][kimi] prompt ${i + 1}/${count} | category=${detectedCategory} | style=${style} | layoutNotes=${layoutNotes || "(none)"}`
    );
    console.log(finalPrompt);
    return finalPrompt;
  });
  return prompts;
}

const KIMI_HEADSHOT_STYLE_TAGS = [
  "studio-portrait",
  "environmental",
  "corporate",
  "casual",
  "editorial",
  "minimal-backdrop",
  "soft-natural",
  "dramatic-lighting",
] as const;

const KIMI_HEADSHOT_SYSTEM_PROMPT = `You are a senior portrait and headshot director. Your job is to generate detailed, production-ready image prompts for an AI image model to create professional headshots. The subject is always the person in the reference image; your task is to describe varied professional headshot concepts that preserve their likeness and identity.

EXECUTION STANDARDS (apply in every prompt)
1. TENSION: One point of visual or emotional interest that makes the image feel intentional – a moment, expression, or composition choice that feels considered, not generic.
2. ONE HERO: The person is the single undisputed focal point. Background, clothing, and lighting all support the subject. Nothing competes for attention.
3. TRUTH DETAIL: One unexpected specific detail that signals authenticity – a natural expression, a texture, a catchlight, or an environmental cue that makes the image feel real.
4. VISUAL HIERARCHY: The eye moves naturally to the face first, then to expression and posture. Design the frame so the subject commands attention.
5. COLOR INTENTION: Every color serves a purpose – skin tones accurate and flattering, background and clothing support mood and professionalism without overwhelming.

PERSON / LIKENESS RULES (non-negotiable – outputs must look like the same person)
- Person image rule: Every prompt MUST start with this exact IDENTITY LOCK (hard constraint, not a request): "Create a professional headshot using the reference image provided (which shows the person). IDENTITY LOCK: facial bone structure, face shape, facial proportions, eye spacing, eye shape, eye color, nose shape, lip shape, skin tone, and all distinguishing features must be reproduced exactly as shown in the reference — these are non-negotiable. Only clothing, expression, pose, background, and lighting may change. This is the same person in a different environment, not a similar-looking person." Then continue with the scene.
- Perceptual anchor: Tell the model what identity consists of — bone structure, face shape, proportions, skin tone — so it does not weight hair or style as identity. Facial bone structure, facial proportions, and skin tone are identity, not appearance; do not alter them.
- Never describe the person's appearance: Do NOT write hair color, eye color, skin tone, age, ethnicity, or any physical description. The image model receives the reference as input; describing the person risks the model generating a different face. Refer to the subject only as "the reference image provided," "the person in the reference," or "the subject" – never substitute with a description.
- Fidelity: The same recognizable person in every output. No identity drift, no different face, no altered proportions. Clothing, background, lighting, and pose vary; the person's identity does not. Eye color, eye shape, and eye spacing must be reproduced exactly as shown in the reference. Do not lighten, shift, or alter eye color in any direction.
- Likeness negatives: In every prompt include: "No different face, no altered identity, no changing skin tone or facial structure, no extra person in frame. No altered eye color, no lightened eyes, no green or hazel substitution for dark eyes. No softening or idealizing of facial features, no shift in face shape or proportions, no different ethnicity, no younger or older version of the subject, no composite face."
- Style reference images: If style reference images are attached (headshot examples), use them for target visual quality, lighting style, and composition language only. Never copy another person's face from style refs – the subject is always the person in the first (reference) image.

HEADSHOT CONCEPT TYPES (use one per prompt; vary across the batch)
Use ONLY these as the concept bucket for each prompt. Each prompt must use a DISTINCT type:
1. Studio portrait – classic key/fill/rim, neutral or subtle backdrop
2. Environmental – person in a real location (office, outdoor, café, urban) that supports their role
3. Corporate – professional, confident, clean backdrop, business-appropriate
4. Casual – approachable, natural light, relaxed but polished
5. Editorial – magazine-quality, strong composition, mood-led
6. Minimal backdrop – soft gradient or simple surface, focus entirely on subject
7. Soft natural – window light, soft diffusion, flattering and warm
8. Dramatic lighting – single key or rim, high contrast, characterful

IMAGE PROMPT ANATOMY (compact; no ad copy)
Build each prompt in this sequence:
1. [OPENING – IDENTITY LOCK] "Create a professional headshot using the reference image provided (which shows the person). IDENTITY LOCK: facial bone structure, face shape, facial proportions, eye spacing, eye shape, eye color, nose shape, lip shape, skin tone, and all distinguishing features must be reproduced exactly as shown in the reference — these are non-negotiable. Only clothing, expression, pose, background, and lighting may change. This is the same person in a different environment, not a similar-looking person. [Concept type] headshot: [one-sentence scene]. "
2. [LIGHTING] "Lighting: [key direction and temperature], [fill if needed], [rim/accent when suitable]. One coherent light direction; flattering to skin tones."
3. [CAMERA] "Camera: [lens feel], [angle], [framing – e.g. chest-up, head and shoulders]. Realistic perspective, sharp on eyes and face."
4. [BACKGROUND + MOOD] "Background: [specific – e.g. soft grey gradient, blurred office, natural foliage]. Mood: [2–3 descriptors]. No text, no logos, no watermarks."
5. [NEGATIVES + FINISH] "Negatives: no different face, no altered identity, no changing skin tone or facial structure, no extra person in frame. No altered eye color, no lightened eyes, no green or hazel substitution for dark eyes. No softening or idealizing of facial features, no shift in face shape or proportions, no different ethnicity, no younger or older version of the subject, no composite face. No distorted anatomy, no mismatched lighting, no pasted-on look. Same person as reference only. Finish: subtle vignette, light neutral grain, professional retouching. Style reference: this creative follows [style-tag] characteristics with professional headshot quality."
6. [QUALITY] "Photorealistic, high-resolution, professional headshot output. Before rendering: verify that facial geometry matches the reference image exactly. The subject must be immediately recognizable as the same individual."

STYLE REFERENCE ANCHOR (required)
End every prompt with a sentence: "Style reference: this creative follows [style-tag] characteristics ..." with a concise quality benchmark. Use style tags from the allowed list.

BATCH RULES
- Return exactly the requested number of prompts.
- Each prompt must use a different headshot concept type from the list above. No two prompts same concept type.
- Vary background, lighting style, and framing across the batch. The set should feel like one person, multiple professional headshot options.
- Allowed style tags: ${KIMI_HEADSHOT_STYLE_TAGS.join(", ")}. Use a varied mix; no tag more than twice.

OUTPUT FORMAT:
Return ONLY valid JSON: array of objects with keys "prompt", "style", "layoutNotes".
Style must be one of the allowed tags. No markdown, no commentary, no extra keys.`;

function outputSpecForHeadshotSize(size: KimiHeadshotRequest["size"]): string {
  switch (size) {
    case "story":
      return "9:16 vertical (stories/mobile), shortest edge >= 2048px.";
    case "landscape":
      return "16:9 horizontal, shortest edge >= 2048px.";
    case "portrait":
      return "3:4 portrait, shortest edge >= 2048px.";
    case "square":
    default:
      return "1:1 square (social feed), shortest edge >= 2048px.";
  }
}

const KIMI_HEADSHOT_IDENTITY_EXTRACT_SYSTEM = `You are an analyst for identity-preserving image generation. Look at the reference photo and extract factual, observable identity details that an image model can use as ground truth. Return ONLY valid JSON – no markdown, no commentary.

Required: eyeColor – exact description for prompt injection (e.g. "deep dark brown, nearly black", "light blue", "hazel with green flecks"). Be specific so the image model does not guess or drift.
Optional: faceShape (one short phrase), skinUndertone (e.g. warm, cool, neutral), distinctiveFeatures (array of 1–3 items: nose shape, lip fullness, jawline, etc.), signatureAccessories (array: visible jewelry, glasses, etc.).

Output format: {"eyeColor":"...", "faceShape":"...", "skinUndertone":"...", "distinctiveFeatures":["..."], "signatureAccessories":["..."]}
All keys must be present; use empty string or empty array if not observable.`;

/** Analyzes the person reference image and returns an identity card (eye color + optional traits) for injection into headshot prompts. Uses Kimi vision so the image model gets explicit ground truth. */
export async function extractHeadshotIdentityCard(
  imageUrlOrDataUrl: string
): Promise<HeadshotIdentityCard | null> {
  const dataUrl =
    imageUrlOrDataUrl.startsWith("data:")
      ? imageUrlOrDataUrl
      : await fetchImageAsDataUrl(imageUrlOrDataUrl);
  if (!dataUrl) return null;
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: "Analyze this reference photo. Extract identity details for image-generation prompts. Return ONLY the JSON object, no other text.",
    },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system", content: KIMI_HEADSHOT_IDENTITY_EXTRACT_SYSTEM },
      { role: "user", content: userContent },
    ],
    max_completion_tokens: 512,
    thinking: { type: "disabled" as const },
  };
  try {
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const rawBody = await res.text();
    if (!res.ok) return null;
    const data = JSON.parse(rawBody) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const card = JSON.parse(jsonStr) as HeadshotIdentityCard;
    if (typeof card?.eyeColor !== "string" || !card.eyeColor.trim()) return null;
    return {
      eyeColor: card.eyeColor.trim(),
      faceShape: typeof card.faceShape === "string" ? card.faceShape.trim() : undefined,
      skinUndertone: typeof card.skinUndertone === "string" ? card.skinUndertone.trim() : undefined,
      distinctiveFeatures: Array.isArray(card.distinctiveFeatures)
        ? card.distinctiveFeatures.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
        : undefined,
      signatureAccessories: Array.isArray(card.signatureAccessories)
        ? card.signatureAccessories.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function generateHeadshotPromptsWithKimi(
  req: KimiHeadshotRequest,
  options?: { count?: number; noveltyMemory?: KimiProjectNoveltyMemory }
): Promise<string[]> {
  const count = Math.max(1, Math.min(20, options?.count ?? 5));
  const personDataUrlPromise = fetchImageAsDataUrl(req.personImageUrl);
  const referenceDataUrlsPromise =
    req.referenceImageUrls?.length ?
      Promise.all(
        req.referenceImageUrls.slice(0, 6).map((url) => fetchImageAsDataUrl(url))
      ).then((arr) => arr.filter((v): v is string => Boolean(v)))
    : Promise.resolve<string[]>([]);
  const [personDataUrl, referenceDataUrls] = await Promise.all([
    personDataUrlPromise,
    referenceDataUrlsPromise,
  ]);
  if (!personDataUrl) {
    throw new Error("Failed to load person image for headshot prompts.");
  }
  const identityCard = await extractHeadshotIdentityCard(personDataUrl);
  if (identityCard) {
    console.log("[headshots][identity-card]", {
      eyeColor: identityCard.eyeColor,
      ...(identityCard.faceShape && { faceShape: identityCard.faceShape }),
      ...(identityCard.skinUndertone && { skinUndertone: identityCard.skinUndertone }),
      ...(identityCard.distinctiveFeatures?.length && { distinctiveFeatures: identityCard.distinctiveFeatures }),
      ...(identityCard.signatureAccessories?.length && { signatureAccessories: identityCard.signatureAccessories }),
    });
  }
  const userText = `Generate exactly ${count} detailed headshot image prompts for the person in the attached reference image.
${identityCard ? `
IDENTITY CARD (vision-extracted from reference – use as ground truth in every prompt):
- Eye color: ${identityCard.eyeColor}
${identityCard.faceShape ? `- Face shape: ${identityCard.faceShape}` : ""}
${identityCard.skinUndertone ? `- Skin undertone: ${identityCard.skinUndertone}` : ""}
${identityCard.distinctiveFeatures?.length ? `- Distinctive features: ${identityCard.distinctiveFeatures.join("; ")}` : ""}
${identityCard.signatureAccessories?.length ? `- Signature accessories: ${identityCard.signatureAccessories.join("; ")}` : ""}

In every prompt you MUST include the exact eye color from the identity card so the image model has explicit ground truth. Add this line immediately after the IDENTITY LOCK opening in each prompt: "Eye color: ${identityCard.eyeColor} – do not alter." This is an identity anchor (observed fact), not a creative description – include it in full. You may also reference other identity card fields (face shape, skin undertone, distinctive features, accessories) in the prompt when relevant so the model does not guess.
` : ""}

LIKENESS IS NON-NEGOTIABLE (same person in every output):
- The image model receives the person's photo as the first reference image. Identity is a hard constraint: facial bone structure, facial proportions, and skin tone are identity, not appearance — do not alter them. Your prompts must tell the model what to lock (bone structure, face shape, proportions, eye spacing, nose, lip shape, skin tone) so it does not treat hair or style as identity.
- Use the exact IDENTITY LOCK opening in every prompt: "Create a professional headshot using the reference image provided (which shows the person). IDENTITY LOCK: facial bone structure, face shape, facial proportions, eye spacing, eye shape, eye color, nose shape, lip shape, skin tone, and all distinguishing features must be reproduced exactly as shown in the reference — these are non-negotiable. Only clothing, expression, pose, background, and lighting may change. This is the same person in a different environment, not a similar-looking person."
- Never describe the person's appearance (hair, eyes, skin, age, etc.) in the prompt – that can cause the model to generate a different face. Refer only to "the reference image provided" or "the person in the reference."
- Every prompt must include the full likeness negatives: "No different face, no altered identity, no changing skin tone or facial structure, no extra person in frame. No altered eye color, no lightened eyes, no green or hazel substitution for dark eyes. No softening or idealizing of facial features, no shift in face shape or proportions, no different ethnicity, no younger or older version of the subject, no composite face."
- End every prompt with: "Before rendering: verify that facial geometry matches the reference image exactly. The subject must be immediately recognizable as the same individual."

DIVERSITY REQUIREMENT:
Use the 8 headshot concept types only. Each of the ${count} prompts must use a DIFFERENT one of these – no two prompts may share the same concept type:
1. Studio portrait | 2. Environmental | 3. Corporate | 4. Casual | 5. Editorial | 6. Minimal backdrop | 7. Soft natural | 8. Dramatic lighting
Pick ${count} distinct concept types so the set is genuinely diverse (e.g. different backgrounds, lighting styles, and moods). Only the scene/lighting/background vary – the person stays the same.

Person image is attached (first image). Every prompt MUST start with the full IDENTITY LOCK sentence: "Create a professional headshot using the reference image provided (which shows the person). IDENTITY LOCK: facial bone structure, face shape, facial proportions, eye spacing, eye shape, eye color, nose shape, lip shape, skin tone, and all distinguishing features must be reproduced exactly as shown in the reference — these are non-negotiable. Only clothing, expression, pose, background, and lighting may change. This is the same person in a different environment, not a similar-looking person. "

${
  referenceDataUrls.length > 0
    ? `Style reference images attached (${referenceDataUrls.length} image(s)). Use them for lighting, composition, and professional headshot quality only – the subject is always the person in the first image, not anyone in the style refs.`
    : "No style reference images attached."
}

Output format: ${outputSpecForHeadshotSize(req.size)}

Allowed style tags (use a varied mix): ${KIMI_HEADSHOT_STYLE_TAGS.join(", ")}

CRITICAL:
1. Likeness first: every prompt must include the full IDENTITY LOCK opening, the full likeness negatives (including no softening/idealizing, no ethnicity or age shift, no composite face), and end with the verification line: "Before rendering: verify that facial geometry matches the reference image exactly. The subject must be immediately recognizable as the same individual."
2. Each prompt = a different headshot concept type. Vary background, lighting, and mood only – same person.
3. Never describe the person's physical appearance. No headline, sub-headline, CTA, or text in the image.
4. End every prompt with the style reference anchor sentence and the verification line above.
5. Keep each prompt compact but complete (~200–300 words): scene, lighting, camera, background, mood, negatives, quality descriptors.

Return JSON array only. No markdown, no commentary.`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: userText }];
  content.push({ type: "image_url", image_url: { url: personDataUrl } });
  referenceDataUrls.forEach((url) =>
    content.push({ type: "image_url", image_url: { url } })
  );

  const messages: Array<
    | { role: "system"; content: string }
    | {
        role: "user";
        content: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
      }
  > = [
    { role: "system", content: KIMI_HEADSHOT_SYSTEM_PROMPT },
    { role: "user", content },
  ];

  const payload = {
    model: KIMI_MODEL,
    messages,
    max_completion_tokens: 8192,
    thinking: { type: "disabled" as const },
  };

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi API (headshots): ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi headshot prompts: invalid JSON response");
  }
  const message = data.choices?.[0]?.message;
  const text = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!text) throw new Error("Kimi headshot prompts: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let arr: KimiPhotoPromptItem[];
  try {
    arr = JSON.parse(jsonStr) as KimiPhotoPromptItem[];
  } catch {
    throw new Error("Kimi headshot prompts: response is not valid JSON array");
  }
  if (!Array.isArray(arr) || arr.length < count) {
    throw new Error(
      `Kimi headshot prompts: returned ${arr?.length ?? 0}, need ${count}`
    );
  }

  const prompts = arr.slice(0, count).map((item, i) => {
    const style = typeof item?.style === "string" ? item.style.trim() : "unknown";
    const layoutNotes =
      typeof item?.layoutNotes === "string" ? item.layoutNotes.trim() : "";
    const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) {
      throw new Error(`Kimi headshot prompts: empty prompt at index ${i + 1}`);
    }
    console.log(
      `[headshots][kimi] prompt ${i + 1}/${count} | style=${style} | layoutNotes=${layoutNotes || "(none)"}`
    );
    return prompt;
  });
  return prompts;
}

const KIMI_THUMBNAIL_SYSTEM_PROMPT = `You are a senior creative director specializing in YouTube thumbnails. Your job is to generate detailed, production-ready image prompts for an AI image model to create click-worthy YouTube thumbnail images.

CONTEXT:
- The attached style reference images are examples of effective YouTube thumbnails. Study them for: bold readable text, strong focal point, high contrast, dynamic composition, and layout that works at small sizes.
- Output is for thumbnails only: no CTA buttons, no ad copy, no product pitches. Focus on thumbnail-specific impact: curiosity, emotion, clarity.

EXECUTION STANDARDS (apply in every prompt):
1. ONE HERO: A single clear focal point – a face, key object, or bold text block. Everything else supports it.
2. TEXT: When text is required, it must be large, bold, high-contrast, and readable at thumbnail size. Specify exact wording when provided; otherwise propose short punchy hook text from the video topic.
3. VISUAL HIERARCHY: Eye path is deliberate – entry point (often text or face) → supporting elements. No clutter.
4. COLOR: High contrast so the thumbnail stands out in a grid. Avoid muddy or low-contrast palettes. When the brief transfers psychology from an analyzed video, choose palettes and motifs that do NOT mimic that source thumbnail's look.
5. Image inputs after the style references arrive in this order: (A) preserved real-photo frame(s) if any — third-party or video-subject photos where the whole photo (person and visible background inside that shot) must appear unchanged; (B) creator / host reference(s) if any — keep the same recognizable identity, relight and compose boldly for thumbnail impact; (C) object / product / place references if any — incorporate naturally. If only style references are attached (no A/B/C), create compelling thumbnails using text, graphics, and suggested imagery only. Never use the written brief to invent a face that matches an original video creator from an "analyze video" workflow — only attached creator references define the host likeness.

OUTPUT FORMAT:
Return ONLY valid JSON: array of objects with keys "prompt", "style", "layoutNotes".
Style is a short tag (e.g. "face-forward", "text-dominant", "object-hero"). No markdown, no commentary.`;

function outputSpecForThumbnailSize(size: KimiThumbnailRequest["size"]): string {
  switch (size) {
    case "story":
      return "9:16 vertical (thumbnail), shortest edge >= 2048px.";
    case "landscape":
      return "16:9 horizontal (YouTube default), shortest edge >= 2048px.";
    case "portrait":
      return "3:4 portrait, shortest edge >= 2048px.";
    case "square":
    default:
      return "1:1 square, shortest edge >= 2048px.";
  }
}

export async function generateThumbnailPromptsWithKimi(
  req: KimiThumbnailRequest,
  options?: { count?: number; noveltyMemory?: KimiProjectNoveltyMemory }
): Promise<string[]> {
  const count = Math.max(1, Math.min(20, options?.count ?? 5));
  const referenceDataUrlsPromise =
    req.referenceImageUrls?.length
      ? Promise.all(
          req.referenceImageUrls.slice(0, 6).map((url) => fetchImageAsDataUrl(url))
        ).then((arr) => arr.filter((v): v is string => Boolean(v)))
      : Promise.resolve<string[]>([]);
  const preservedDataUrlsPromise =
    req.preservedPhotoUrls?.length
      ? Promise.all(
          req.preservedPhotoUrls.slice(0, 3).map((url) => fetchImageAsDataUrl(url))
        ).then((arr) => arr.filter((v): v is string => Boolean(v)))
      : Promise.resolve<string[]>([]);
  const personDataUrlsPromise =
    req.personImageUrls?.length
      ? Promise.all(
          req.personImageUrls.slice(0, 3).map((url) => fetchImageAsDataUrl(url))
        ).then((arr) => arr.filter((v): v is string => Boolean(v)))
      : Promise.resolve<string[]>([]);
  const objectDataUrlsPromise =
    req.objectImageUrls?.length
      ? Promise.all(
          req.objectImageUrls.slice(0, 3).map((url) => fetchImageAsDataUrl(url))
        ).then((arr) => arr.filter((v): v is string => Boolean(v)))
      : Promise.resolve<string[]>([]);

  const [referenceDataUrls, preservedDataUrls, personDataUrls, objectDataUrls] = await Promise.all([
    referenceDataUrlsPromise,
    preservedDataUrlsPromise,
    personDataUrlsPromise,
    objectDataUrlsPromise,
  ]);

  const textInstruction = req.thumbnailText
    ? `Thumbnail text (include this EXACT text on the thumbnail): ${req.thumbnailText}`
    : "Generate short, punchy thumbnail text from the video topic. Include the exact wording you want in each prompt so it appears in the image.";
  const preservedInstruction =
    preservedDataUrls.length > 0
      ? `PRESERVED REAL-PHOTO FRAME(S) attached (${preservedDataUrls.length}) — third-party or video-subject photos (e.g. celebrity, guest, clip still).

NON-NEGOTIABLE for these images:
- The model must place the photograph into the final thumbnail as an UNCHANGED photographic region: same person, same pose, same clothing, same expression, and the visible background *inside that photo* must stay as captured — no repainting, no stylization, no face swap, no "improved" likeness.
- Build the YouTube thumbnail AROUND this intact photo: extra graphics, headlines, borders, outer background extension, and layout may be bold and stylized, but the preserved photo pixels must read as the original shot.
- In each prompt, explicitly instruct which preserved reference(s) stay frozen and where they sit in the layout.`
      : "No preserved third-party / video-subject photo — you may compose humans from scratch only when no preserved frames are attached; never invent a named real person's likeness.";
  const personInstruction =
    personDataUrls.length > 0
      ? `Creator / channel-owner reference photo(s) attached (${personDataUrls.length}). Same person as the channel host — keep IDENTITY CONSISTENT (recognizably the same individual).

- The image model may relight, change pose and expression, crop, and integrate them into bold thumbnail scenes, but must NOT turn them into a different person.
- Do not use these references for third-party celebrity likenesses.`
      : "No creator reference photo provided. Omit a required human subject unless preserved or object references imply one.";
  const objectInstruction =
    objectDataUrls.length > 0
      ? `Object / product / environment reference image(s) attached (${objectDataUrls.length}). Integrate naturally with reasonable creative freedom — show products in context, let places inspire backgrounds, place logos cleanly.`
      : "No object images provided.";

  const brainBlock = req.creatorBrainSummary?.trim()
    ? `\nCreator / channel context (tone and audience):\n${req.creatorBrainSummary.trim().slice(0, 2500)}\n`
    : "";

  const noveltyMemoryText = options?.noveltyMemory
    ? `
PROJECT-SCOPED NOVELTY MEMORY (same project only; do NOT repeat these):
Lookback thumbnails analyzed: ${options.noveltyMemory.lookbackCount}
Blocked exact concept tuples (do not repeat these combinations):
${options.noveltyMemory.blockedTuples.length ? options.noveltyMemory.blockedTuples.map((t) => `- ${t}`).join("\n") : "- none"}

Overused dimensions to avoid when possible:
- style tags: ${options.noveltyMemory.avoidStyleTags.join(", ") || "none"}
- concept mechanics: ${options.noveltyMemory.avoidConceptMechanics.join(", ") || "none"}
- hero actions: ${options.noveltyMemory.avoidHeroActions.join(", ") || "none"}
- layout modes: ${options.noveltyMemory.avoidLayoutModes.join(", ") || "none"}
- environment families: ${options.noveltyMemory.avoidEnvironmentFamilies.join(", ") || "none"}

Novelty requirements for this run:
- at least ${options.noveltyMemory.requiredNovelty.minUnseenConcepts} prompts must use concept mechanics not in overused list.
- at least ${options.noveltyMemory.requiredNovelty.minUnseenHeroActions} prompts must use hero actions not in overused list.
- at least ${options.noveltyMemory.requiredNovelty.minUnseenTuples} prompts must use unseen tuple combinations.
- Even when reusing a style, the underlying thumbnail idea MUST be materially different (concept + composition + focal point must differ).

Recent concept cards (do NOT repeat these too closely):
${options.noveltyMemory.recentConceptCards?.length
  ? options.noveltyMemory.recentConceptCards.map((c, idx) => `${idx + 1}. ${c}`).join("\n")
  : "- none"}`
    : "";

  const preambleBlock = req.promptPreamble?.trim() ? `${req.promptPreamble.trim()}\n\n` : "";

  const userText = `${preambleBlock}Generate exactly ${count} detailed YouTube thumbnail image prompts.

DIVERSITY REQUIREMENT (non-negotiable):
Use distinct thumbnail concept types only. Each of the ${count} prompts must use a DIFFERENT one of these – no two prompts may share the same concept type:
1. Face-forward (person facing camera, expressive) | 2. Text-dominant (large headline as hero) | 3. Object-hero (product/object as focal point) | 4. Reaction (surprised/excited expression) | 5. Split or comparison | 6. Close-up face | 7. Person pointing or gesturing | 8. Number/stat callout | 9. Question or mystery hook | 10. List or steps | 11. Before/after | 12. Minimal text + mood | 13. Collage or multi-panel | 14. Dramatic lighting
Pick ${count} distinct concept types for this batch so the set is genuinely diverse. No two prompts the same (concept type + composition + visual hook must differ).

Video topic / what the video is about:
${req.videoAbout}

${textInstruction}
${preservedInstruction}
${personInstruction}
${objectInstruction}
${brainBlock}

IMAGE ORDER (after style thumbnails): first preserved real-photo frame(s) if any, then creator/host reference(s) if any, then object/product/place references if any. The downstream image model receives references in that same order — each JSON prompt must say which inputs are preserved vs creator vs assets.

Style reference images attached (${referenceDataUrls.length} image(s)). Study them for layout, typography, composition, and thumbnail impact. Match that level of clarity and click-worthiness.
${noveltyMemoryText || ""}

Requirements:
1. DIVERSITY: Each prompt = a different thumbnail concept type (see list above). Not just different text or background.
2. Bold, readable text; strong focal point; high contrast. Suitable for YouTube thumbnail grid.
3. Output format: ${outputSpecForThumbnailSize(req.size)}
4. Keep each prompt compact but complete: scene, text (exact wording), layout, lighting, colors, negatives.
5. In the "style" field of each JSON object, use the concept type tag (e.g. face-forward, text-dominant, reaction) so we can verify diversity.
6. ANTI-COPYCAT / DISTINCT EXECUTION: If the video topic includes anti-copycat language or psychology transferred from an analyzed thumbnail, treat that as strategic insight only — never recreate that thumbnail's layout formula, color scheme, arrow graphics, asset rendering style, or specific metaphor. Each of the ${count} prompts must use a materially different visual concept and composition structure from the others (not the same template with a swapped face). At least two prompts should diverge strongly in metaphor and layout archetype.

Return JSON array only. No markdown, no commentary.`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: userText }];
  referenceDataUrls.forEach((url) => content.push({ type: "image_url", image_url: { url } }));
  preservedDataUrls.forEach((url) => content.push({ type: "image_url", image_url: { url } }));
  personDataUrls.forEach((url) => content.push({ type: "image_url", image_url: { url } }));
  objectDataUrls.forEach((url) => content.push({ type: "image_url", image_url: { url } }));

  const messages: Array<
    | { role: "system"; content: string }
    | {
        role: "user";
        content: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
      }
  > = [{ role: "system", content: KIMI_THUMBNAIL_SYSTEM_PROMPT }, { role: "user", content }];

  const payload = {
    model: KIMI_MODEL,
    messages,
    max_completion_tokens: 8192,
    thinking: { type: "disabled" as const },
  };

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi API (thumbnails): ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi thumbnail prompts: invalid JSON response");
  }
  const message = data.choices?.[0]?.message;
  const text = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!text) throw new Error("Kimi thumbnail prompts: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let arr: KimiPhotoPromptItem[];
  try {
    arr = JSON.parse(jsonStr) as KimiPhotoPromptItem[];
  } catch {
    throw new Error("Kimi thumbnail prompts: response is not valid JSON array");
  }
  if (!Array.isArray(arr) || arr.length < count) {
    throw new Error(
      `Kimi thumbnail prompts: returned ${arr?.length ?? 0}, need ${count}`
    );
  }

  const prompts = arr.slice(0, count).map((item, i) => {
    const style = typeof item?.style === "string" ? item.style.trim() : "unknown";
    const layoutNotes =
      typeof item?.layoutNotes === "string" ? item.layoutNotes.trim() : "";
    const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) {
      throw new Error(`Kimi thumbnail prompts: empty prompt at index ${i + 1}`);
    }
    console.log(
      `[thumbnails][kimi] prompt ${i + 1}/${count} | style=${style} | layoutNotes=${layoutNotes || "(none)"}`
    );
    return prompt;
  });
  return prompts;
}

export function isKimiConfigured(): boolean {
  return Boolean(process.env.KIMI_API_KEY);
}

function getAuthHeader(): string {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error("KIMI_API_KEY is not set");
  return `Bearer ${key}`;
}

/** Fetch image from URL and return as data URL (data:image/...;base64,...) for Kimi. */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const normalizedUrl = imageUrl.trim();
  const isLikelyLocalPath =
    /^[a-zA-Z]:[\\/]/.test(normalizedUrl) ||
    normalizedUrl.startsWith("/") ||
    normalizedUrl.startsWith("./") ||
    normalizedUrl.startsWith("../");
  const isHttpUrl = /^https?:\/\//i.test(normalizedUrl);
  const looksLikeWindowsAbsPath = /^[a-zA-Z]:[\\/]/.test(normalizedUrl);
  if (looksLikeWindowsAbsPath || normalizedUrl.startsWith("/") || normalizedUrl.startsWith("./") || normalizedUrl.startsWith("../")) {
    try {
      const abs = looksLikeWindowsAbsPath ? normalizedUrl : path.resolve(process.cwd(), normalizedUrl);
      const baseName = path.basename(abs).toLowerCase();
      const useCache = DEFAULT_LOCAL_REFERENCE_BASENAMES.has(baseName);
      const stat = await fs.stat(abs);
      if (useCache) {
        const cached = localImageDataUrlCache.get(abs);
        if (cached && cached.mtimeMs === stat.mtimeMs) {
          imageDataUrlCacheStats.localHit += 1;
          console.log("[Kimi] 1. Using cached local reference image:", abs);
          logImageDataUrlCacheStats("local-hit");
          return cached.dataUrl;
        }
      }
      const buffer = await fs.readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      const mime =
        ext === ".png" ? "image/png"
          : ext === ".webp" ? "image/webp"
            : "image/jpeg";
      const base64 = buffer.toString("base64");
      if (base64.length > 0) {
        console.log("[Kimi] 1. Loaded local reference image:", abs, "base64 length:", base64.length, "mime:", mime);
        const dataUrl = `data:${mime};base64,${base64}`;
        if (useCache) {
          localImageDataUrlCache.set(abs, { mtimeMs: stat.mtimeMs, dataUrl });
        }
        return dataUrl;
      }
    } catch (e) {
      console.warn("[Kimi] 1. Local image read failed:", normalizedUrl, e);
      // Local path could not be read; do not pass file-like paths to fetch(),
      // because undici treats them as invalid URLs and throws ERR_INVALID_URL.
      if (isLikelyLocalPath && !isHttpUrl) return null;
    }
  }
  if (!isHttpUrl) return null;
  const timeoutsMs = [25000, 45000, 60000];
  for (let i = 0; i < timeoutsMs.length; i++) {
    const timeoutMs = timeoutsMs[i]!;
    try {
      const nowMs = Date.now();
      const cachedRemote = remoteImageDataUrlCache.get(normalizedUrl);
      if (cachedRemote && cachedRemote.expiresAt > nowMs) {
        imageDataUrlCacheStats.remoteHit += 1;
        console.log("[Kimi] 1. Using cached remote image:", normalizedUrl.slice(0, 80) + (normalizedUrl.length > 80 ? "…" : ""));
        logImageDataUrlCacheStats("remote-hit");
        return cachedRemote.dataUrl;
      }
      imageDataUrlCacheStats.miss += 1;
      logImageDataUrlCacheStats("miss");
      console.log("[Kimi] 1. Fetching image:", normalizedUrl.slice(0, 80) + (normalizedUrl.length > 80 ? "…" : ""), `attempt ${i + 1}/${timeoutsMs.length}`, `timeout ${timeoutMs}ms`);
      const res = await fetch(normalizedUrl, { signal: AbortSignal.timeout(timeoutMs) });
      console.log("[Kimi] 1. Image fetch status:", res.status, res.statusText);
      if (!res.ok) {
        console.warn("[Kimi] 1. Image fetch failed:", res.status, await res.text().catch(() => ""));
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      const mime = contentType.includes("png") ? "image/png" : contentType.includes("webp") ? "image/webp" : "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      const dataUrl = base64.length > 0 ? `data:${mime};base64,${base64}` : null;
      console.log("[Kimi] 1. Image loaded, base64 length:", base64.length, "mime:", mime);
      if (dataUrl) {
        remoteImageDataUrlCache.set(normalizedUrl, {
          expiresAt: Date.now() + REMOTE_IMAGE_DATA_URL_CACHE_TTL_MS,
          dataUrl,
        });
        pruneRemoteImageDataUrlCache(Date.now());
        return dataUrl;
      }
    } catch (e) {
      console.warn("[Kimi] 1. Image fetch error:", e);
    }
  }
  // Do not fallback to direct URL: Kimi often rejects temporary CDN image URLs.
  // Returning null lets callers handle provider/network issues explicitly.
  return null;
}

const YOUTUBE_THUMB_VISION_SYSTEM = `You are a YouTube strategist analyzing an actual video thumbnail image (pixels).

This analysis feeds another creator's NEW video (not the original channel). Your job is to extract TRANSFERABLE PSYCHOLOGY only — why the thumbnail works on viewers — not a recipe to copy its execution.

FORBIDDEN in every field: specific colors or palettes; pixel positions (left/right/center); arrow styles; logo or coin treatments; fonts; compositional formulas ("split screen", "face left + object right"); named props; or any wording that would let someone recreate this exact layout or look. Do not describe the original creator's face, hair, skin, clothing, or body in identifiable terms.

Return ONLY a valid JSON object (no markdown fences, no preamble) with exactly these string keys. Each value must be 2–5 short sentences, grounded in the image but expressed as abstract psychology:
- primary_emotional_trigger: The dominant feeling or tension this thumbnail evokes (e.g. dread, greed, outrage, FOMO, relief).
- psychological_click_mechanism: Why that feeling makes someone click — cognitive dissonance, stakes, identity, social proof, fear of missing out, etc.
- information_processing_hierarchy: What the viewer processes cognitively first, second, and third (e.g. "warning cue → asset identity → headline contradiction"). Describe mental order, not screen positions or colors.
- authority_credibility_signal: How the thumbnail signals expertise, confrontation, trust, or urgency in the abstract (e.g. "direct address to camera" as a pattern, "institutional vs retail framing") — never describe a real individual's appearance.
- curiosity_gap: The implied question or contradiction the video promises to resolve.

If the image fails to load or is unreadable, return the same keys with brief honest values.`;

/** Vision pass on the real thumbnail for Analyze This Video (feeds DeepSeek context). */
export async function analyzeYoutubeThumbnailForVideoBrief(
  thumbnailHttpUrl: string,
  ctx: { title: string; channel?: string }
): Promise<Record<string, string> | null> {
  const url = thumbnailHttpUrl?.trim();
  if (!url || !isKimiConfigured()) {
    if (!url) console.info("[analyze-video][kimi-thumbnail] skipped: no thumbnail URL");
    else console.info("[analyze-video][kimi-thumbnail] skipped: KIMI_API_KEY not set");
    return null;
  }

  const started = Date.now();
  const dataUrl = await fetchImageAsDataUrl(url);
  if (!dataUrl) {
    console.warn("[analyze-video][kimi-thumbnail] image fetch failed", url.slice(0, 96));
    return null;
  }

  const userText = `Video title: ${ctx.title || "(unknown)"}
${ctx.channel ? `Channel: ${ctx.channel}\n` : ""}
Extract transferable viewer psychology only. The next creator must invent a visually DIFFERENT thumbnail that achieves the same emotional impact — do not document colors, layout, arrows, or specific graphics from this image.`;

  const userContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: dataUrl } },
  ];

  try {
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: "system", content: YOUTUBE_THUMB_VISION_SYSTEM },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1200,
        thinking: { type: "disabled" as const },
      }),
    });
    const rawBody = await res.text();
    if (!res.ok) {
      console.warn("[analyze-video][kimi-thumbnail] API error", res.status, rawBody.slice(0, 200));
      return null;
    }
    const data = JSON.parse(rawBody) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const keys = [
      "primary_emotional_trigger",
      "psychological_click_mechanism",
      "information_processing_hierarchy",
      "authority_credibility_signal",
      "curiosity_gap",
    ] as const;
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = parsed[k];
      out[k] = typeof v === "string" && v.trim() ? v.trim() : "";
    }
    const legacyCopycatKeys = [
      "layout_and_composition",
      "text_and_graphics",
      "color_and_contrast",
      "curiosity_hook",
      "figure_layout_energy",
      "people_and_emotion",
    ] as const;
    for (const lk of legacyCopycatKeys) {
      const legacy = typeof (parsed as Record<string, unknown>)[lk] === "string"
        ? String((parsed as Record<string, unknown>)[lk]).trim()
        : "";
      if (legacy) {
        console.warn("[analyze-video][kimi-thumbnail] dropped legacy thumbnail vision key (copycat/unsafe)", lk);
      }
    }
    console.info("[analyze-video][kimi-thumbnail] ok", {
      ms: Date.now() - started,
      keys_filled: keys.filter((k) => out[k].length > 0).length,
    });
    return out;
  } catch (e) {
    console.warn("[analyze-video][kimi-thumbnail] failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function analyzeYoutubeThumbnailsComparatively(
  thumbnails: Array<{ url: string | null; title: string; channel?: string }>,
  coreTopic: string,
  originalThumbnailIntelligence?: unknown
): Promise<string> {
  const usable = thumbnails.filter((item) => typeof item.url === "string" && item.url.trim().length > 0);
  if (usable.length === 0 || !isKimiConfigured()) {
    const originalContext = typeof originalThumbnailIntelligence === "object" && originalThumbnailIntelligence
      ? JSON.stringify(originalThumbnailIntelligence)
      : "No original thumbnail intelligence available.";
    return `Comparative thumbnail analysis unavailable. Original thumbnail context: ${originalContext}`;
  }

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
  const intro = [
    `You are analyzing ${usable.length} YouTube thumbnails from the top performing videos on the topic of ${coreTopic}.`,
    "Analyze them as a comparative set, not individually.",
    "Identify the dominant visual formula across the set, outlier approaches, dominant emotional trigger, text overlay pattern, and a visual approach absent from the set that would stand out.",
    "Return JSON with keys dominant_visual_formula, outlier_approaches, dominant_emotional_trigger, text_overlay_pattern, absent_visual_opportunity.",
    `Original analyzed video's thumbnail intelligence for context: ${typeof originalThumbnailIntelligence === "object" && originalThumbnailIntelligence ? JSON.stringify(originalThumbnailIntelligence) : "None"}`,
  ].join("\n");
  content.push({ type: "text", text: intro });
  for (const item of usable) {
    const dataUrl = await fetchImageAsDataUrl(item.url!.trim());
    if (!dataUrl) continue;
    content.push({
      type: "text",
      text: `Thumbnail title: ${item.title}${item.channel ? ` | Channel: ${item.channel}` : ""}`,
    });
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  if (content.length < 3) {
    return "Comparative thumbnail analysis unavailable because the additional thumbnails could not be fetched.";
  }

  try {
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a YouTube thumbnail strategist. Compare the provided thumbnails as a set and respond with valid JSON only.",
          },
          { role: "user", content },
        ],
        max_completion_tokens: 1200,
        thinking: { type: "disabled" as const },
      }),
    });
    const rawBody = await res.text();
    if (!res.ok) {
      console.warn("[analyze-video][kimi-thumbnail-compare] API error", res.status, rawBody.slice(0, 200));
      return "Comparative thumbnail analysis unavailable because Kimi returned an error.";
    }
    const data = JSON.parse(rawBody) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  } catch (error) {
    console.warn(
      "[analyze-video][kimi-thumbnail-compare] failed",
      error instanceof Error ? error.message : String(error)
    );
    return "Comparative thumbnail analysis unavailable because the comparative Kimi call failed.";
  }
}

const AD_EDIT_SYSTEM_PROMPT = `You are a senior master-level creative director and designer at a national-tier design agency—the kind that charges $2M for a campaign. Your job is to scrutinize finished ad creatives and take them from "great" (9/10) to "flawless" (10/10) with ultra-specific, production-ready finishing notes.

Given a single ad image, you will:
1. Analyze it in detail: composition, visual hierarchy, color, exposure, contrast, shadows, typography, product prominence, CTA clarity, branding, and overall polish.
2. Identify the handful of refinements that would elevate it to an agency-perfect final master—what you would actually tell a senior retoucher or designer in a handoff.
3. Output exactly ONE natural-language image-editing prompt. This prompt will be sent to an image-editing API. It must read like a single, coherent instruction that one edit call can execute—not a bullet list, not separate sentences that each describe unrelated edits, but one flowing, precise brief (1–3 sentences total).

Output rules:
- Output only the edit prompt text. No preamble, no "Here is the prompt:", no bullets, no numbering.
- Write in clear, natural English, as if you're giving a concise note to a top-tier retoucher.
- The prompt should be 1–3 sentences that together describe one cohesive set of tweaks. It can be as long as needed within that flow to specify all refinements clearly.

When you evaluate the ad, mentally review all of the following:

1) Overall read and hierarchy
- How quickly a viewer understands the core message at a 1–2 second glance.
- Whether the visual hierarchy is clear: hero product and main headline first; then subhead; then CTA and logo; then supporting details.
- The eye path: does the viewer's eye naturally travel from hero to headline to supporting copy to CTA, without getting stuck on distractions or dead zones.

2) Composition and layout
- Cropping and framing of the hero product (not cramped, not too distant, not awkwardly cropped at joints or edges).
- Balance of elements so no area feels unintentionally heavy, empty, or lopsided.
- Spacing and margins around text, logos, and CTA: nothing touching or "kissing" the edges, enough breathing room around key elements.
- Alignment of text blocks, buttons, and cards to an underlying grid or axis; avoid anything that looks one or two pixels off and sloppy.
- Use of negative space to support legibility and focus on the hero and CTA.

3) Color and tone
- Overall exposure and brightness for the intended use (not muddy or washed out, not so dark it kills detail).
- Global contrast so the image feels snappy and clear without clipping shadows or highlights.
- Color harmony: background, props, and UI elements feel like one deliberate palette, and nothing competes with the CTA or brand color.
- White balance or color cast: remove unintended tints that make skin tones, products, or environments look off.
- Product and logo color fidelity: they should look true to the original brand colors, not shifted or stylized.

4) Lighting, depth, and realism
- Consistent light direction and softness across the hero product, props, surfaces, and background.
- Contact shadows under products, props, and CTA elements so nothing appears to float; shadows should match the surface and light direction.
- Depth separation: the hero product should have slightly more clarity or brightness than the background; the background can be slightly softer or darker to push it back.
- Highlights and specular reflections on the hero product to give it presence and dimension, without plastic or blown-out areas.
- Overall sense of realism and physical believability in the scene.

5) Typography and legibility
- Font usage: on-brand, limited font families, no random novelty fonts.
- Size hierarchy: headline clearly larger than subheadline; subheadline larger than body; CTA and small labels sized appropriately for their importance.
- Line length and line spacing for body copy and subheads: avoid overly tight leading or very long, hard-to-read lines.
- Contrast and readability for all text, especially over photos or complex backgrounds; avoid text sitting on busy or high-frequency areas.
- Line breaks: no awkward orphans/widows or strange breaks that hurt the rhythm of the headline or short copy.

6) CTA and branding
- CTA button visibility: strong contrast against its background, clear shape, and placement that makes it the obvious next action.
- CTA label clarity: strong, unambiguous verb phrasing that matches the ad's message.
- Logo size and placement: visible and consistent with brand standards, but not overpowering or awkwardly tucked into a corner.
- Brand color usage: primary and accent colors used intentionally (e.g., CTA, key highlights), not scattered randomly across minor details.

7) Detail polish and artifacts
- Retouching artifacts: no halos, cloning seams, banding, or obvious brushwork in gradients or skies.
- Noise and grain: either clean or with a very subtle, even film-style grain; nothing that feels crunchy, blotchy, or plastic.
- Edge quality around cutouts: no jagged edges, color fringing, or mismatched blur/sharpness around the product or people.
- Compression artifacts, especially in flat color areas, gradients, or text overlays.
- Any unintended UI remnants: no visible grid lines, alignment guides, or artboard edges that should not appear in the final.

8) Micro-adjustments you can ask for
- Slight crop or reposition to better center or balance the hero product or headline within the frame.
- Tiny adjustments to global contrast, midtones, or clarity to make the ad "snap" more while keeping detail.
- A very subtle vignette or edge darkening/lightening to keep focus on the hero product and CTA.
- Slight sharpening or clarity increase on the hero product and important text; the background can stay a bit softer.
- Small nudges of text, CTA, or logo to clean up rhythm, alignment, and spacing.

Non-negotiable guardrails:
- Do NOT change the headline, subheadline, CTA wording, or logo design. You may not invent new copy or alter the meaning of the ad.
- Do NOT change perceived product or logo color; any grading must keep them looking the same to the eye in terms of hue and brand identity.
- Do NOT reduce headline or subheadline readability; you may slightly increase contrast or weight or improve background separation, but never make text lighter, thinner, or lower contrast.
- Do NOT weaken the product's grounding; keep or strengthen soft, natural contact shadows so the product and key elements never look like they're floating.
- Do NOT introduce new props, characters, or major layout changes; this is refinement and polish, not a redesign.

Your job is to assume the ad is already 85–95% correct and then suggest only the last 5–15% finishing tweaks that a high-end creative director would request. Focus on polish, realism, clarity, and perceived quality.

Now, after you've considered all of this, respond with exactly one flowing, natural-language image-editing prompt (1–3 sentences) that describes the specific refinements needed for this ad.`;

/**
 * Uses Kimi 2.5 multimodal to scrutinize the ad and return a single natural-language
 * image-editing prompt (to send to Nano Banana Edit). One prompt, not a list.
 */
export async function suggestAdEditPrompt(imageUrl: string): Promise<string> {
  console.log("[Kimi] 0. suggestAdEditPrompt called, imageUrl length:", imageUrl?.length ?? 0);
  const dataUrl = await fetchImageAsDataUrl(imageUrl.trim());
  if (!dataUrl) {
    console.error("[Kimi] 2. Aborting: could not fetch image");
    throw new Error("Could not fetch image for Kimi");
  }

  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system", content: AD_EDIT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          {
            type: "text",
            text: "Scrutinize this ad and output exactly one natural-language image-editing prompt to take it from 9 to 10. No list, no bullets—only the single edit prompt.",
          },
        ],
      },
    ],
    max_completion_tokens: 8192,
    thinking: { type: "disabled" },
  };
  console.log("[Kimi] 2. Calling Kimi API:", KIMI_BASE + "/chat/completions", "model:", KIMI_MODEL);
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await res.text();
  console.log("[Kimi] 3. Kimi API response status:", res.status, res.statusText);
  console.log("[Kimi] 3. Kimi API response body (full):", rawBody);

  if (!res.ok) {
    console.error("[Kimi] 3. Kimi API error:", rawBody);
    throw new Error(`Kimi API: ${res.status} ${rawBody}`);
  }

  type KimiMessage = { content?: string; reasoning_content?: string };
  let data: { choices?: { message?: KimiMessage }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch (e) {
    console.error("[Kimi] 3. Kimi response not valid JSON:", e);
    throw new Error("Kimi API: invalid JSON response");
  }

  console.log("[Kimi] 3. Full parsed response (every key):", JSON.stringify(data, null, 2));

  const msg = data.choices?.[0]?.message;
  console.log("[Kimi] 3. Full message keys:", msg ? Object.keys(msg) : []);
  if (msg) {
    const m = msg as KimiMessage;
    console.log("[Kimi] 3. message.content length:", m.content?.length ?? 0, "full content:", JSON.stringify(m.content ?? ""));
    console.log("[Kimi] 3. message.reasoning_content length:", m.reasoning_content?.length ?? 0);
    if (m.reasoning_content) console.log("[Kimi] 3. message.reasoning_content (full):", m.reasoning_content);
  }
  let text = msg?.content?.trim();
  // Kimi k2.5 often puts the reply in reasoning_content and leaves content empty
  if (!text && msg && typeof (msg as KimiMessage).reasoning_content === "string") {
    const reasoning = (msg as KimiMessage).reasoning_content!.trim();
    if (reasoning) {
      const paragraphs = reasoning.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const last = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : reasoning;
      // If last paragraph looks truncated (no sentence end or very short), include previous paragraph so we don't lose the tail
      const looksTruncated = last.length < 100 || !/[.!?"]\s*$/.test(last);
      text = paragraphs.length > 1 && looksTruncated
        ? paragraphs.slice(-2).join("\n\n").trim()
        : last || reasoning;
      console.log("[Kimi] 3. Using reasoning_content (content was empty), paragraphs:", paragraphs.length, "truncated?", looksTruncated, "using length:", text.length);
    }
  }
  if (!text) {
    console.error("[Kimi] 3. Kimi returned no content. Full parsed data:", JSON.stringify(data).slice(0, 800));
    throw new Error("Kimi returned no content");
  }
  console.log("[Kimi] 4. Kimi suggestion length:", text.length, "preview:", text.slice(0, 120) + (text.length > 120 ? "…" : ""));
  return text;
}

type ImageShotReviewInput = {
  shotNumber: number;
  shotType: string;
  subjectAndAction: string;
  emotionalFunction: string;
  prompt: string;
  conceptSummary: string;
};

export type PhotoAdQcDecision = "pass" | "edit" | "regenerate";

export type PhotoAdQcResult = {
  decision: PhotoAdQcDecision;
  reason: string;
  issues: string[];
  editPrompt?: string;
  regeneratedPrompt?: string;
  scores: {
    compositionalArchitecture: number;
    lightingQuality: number;
    productPresentation: number;
    colorIntelligence: number;
    typographyIntegration: number;
    emotionalRegister: number;
  };
  weightedScore: number;
};

export type PhotoAdQcInput = {
  imageUrl: string;
  originalPrompt: string;
  headline: string;
  subHeadline: string;
  cta: string;
  productInfo: string;
};

const PHOTO_AD_QC_SYSTEM_PROMPT = `You are a Senior Creative Director at a top agency doing final review before client delivery.
Your job is BOTH quality control and creative elevation.

Return ONLY valid JSON:
{
  "decision": "pass" | "edit" | "regenerate",
  "reason": "one concise sentence",
  "issues": ["issue 1", "issue 2"],
  "scores": {
    "compositionalArchitecture": number,
    "lightingQuality": number,
    "productPresentation": number,
    "colorIntelligence": number,
    "typographyIntegration": number,
    "emotionalRegister": number
  },
  "weightedScore": number,
  "editPrompt": "optional, only when decision=edit",
  "regeneratedPrompt": "optional, only when decision=regenerate"
}

Evaluate against this framework:
1) Compositional Architecture:
- visual entry point clarity (0.3s thumb-stop)
- eye-flow path quality (Z/F/circular, intentional)
- resting point (CTA/product)
- frame balance and thirds/grid placement
2) Lighting Quality:
- key-light environmental logic
- shadow consistency and direction coherence
- rim separation clarity
- color-temperature relationship realism
- specular highlight quality on product surfaces
3) Product Presentation:
- label/copy legibility at mobile scale
- dimensionality (not flat/composited look)
- product-environment integration and contact shadow realism
- scale accuracy
4) Color Intelligence:
- palette cohesion and harmony
- brand color respect
- saturation consistency
- finished grade coherence
5) Typography Integration:
- text contrast/readability
- text-zone quality (low noise)
- typographic hierarchy clarity
- compositional integration of type
6) Emotional Register:
- mood consistency
- expression authenticity (if humans)
- scene believability
- aspiration fit to product positioning

Decision policy:
- PASS only when ship-ready and no meaningful issues.
- EDIT for localized/mechanical issues affecting small regions (<~15%) while rest is strong.
- REGENERATE for structural/compositional/anatomical/geometry failures, major text rendering failures, or category/product truth failures.

Scoring weights:
- compositionalArchitecture: 25%
- lightingQuality: 25%
- productPresentation: 20%
- colorIntelligence: 15%
- typographyIntegration: 10%
- emotionalRegister: 5%

Intervention behavior:
- If decision=edit: provide one surgical edit prompt preserving everything else.
- If decision=regenerate: provide one improved regenerated prompt with only necessary fixes added.
- If decision=regenerate due to text/copy/label rendering failures, regeneratedPrompt MUST include a HARD TEXT LOCK block using the exact required strings from user input:
  HARD TEXT LOCK — these strings must appear exactly as written, no additions, no omissions, no duplications:
  - Headline: "<exact required headline>"
  - Sub-headline: "<exact required sub-headline>"
  - CTA: "<exact required CTA>"
- For text/copy/label regeneration cases, prepend this verification instruction to regeneratedPrompt:
  "Before generating, verify internally that no words are duplicated and all text strings match the HARD TEXT LOCK exactly."
- For mirror/reflection failures include explicit mirror-physics guidance and negatives.
- For shadow inconsistency add explicit single-shadow-direction language.
- For weak integration add contact shadow and environment-integration language.
- For weak hierarchy/flow add explicit thumb-stop and eye-flow architecture.
- Keep fixes minimal and targeted; do not rewrite campaign concept.`;

function clampScore(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Number(v.toFixed(2))));
}

function computeWeightedPhotoAdQcScore(scores: {
  compositionalArchitecture: number;
  lightingQuality: number;
  productPresentation: number;
  colorIntelligence: number;
  typographyIntegration: number;
  emotionalRegister: number;
}): number {
  const weighted =
    scores.compositionalArchitecture * 0.25 +
    scores.lightingQuality * 0.25 +
    scores.productPresentation * 0.2 +
    scores.colorIntelligence * 0.15 +
    scores.typographyIntegration * 0.1 +
    scores.emotionalRegister * 0.05;
  return Number(weighted.toFixed(2));
}

function normalizeQcDecision(raw: string | undefined): PhotoAdQcDecision {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "edit" || v === "regenerate") return v;
  return "pass";
}

/** Review a generated photo ad and return pass/edit/regenerate decision with fix instructions. */
export async function reviewGeneratedPhotoAdForQc(input: PhotoAdQcInput): Promise<PhotoAdQcResult> {
  const dataUrl = await fetchImageAsDataUrl(input.imageUrl.trim());
  if (!dataUrl) throw new Error("Could not fetch image for Kimi photo-ad QC");

  const user = `Required exact text:
- Headline: ${input.headline}
- Sub-headline: ${input.subHeadline}
- CTA: ${input.cta}

Product info:
${input.productInfo}

Original prompt:
${input.originalPrompt}

Review this generated ad image against the required text and prompt intent.
Return JSON only.`;

  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system" as const, content: PHOTO_AD_QC_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: dataUrl } },
          { type: "text" as const, text: user },
        ],
      },
    ],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" as const },
    thinking: { type: "disabled" as const },
  };

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi QC API: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi QC: invalid JSON response envelope");
  }
  const msg = data.choices?.[0]?.message;
  const content = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
  if (!content) throw new Error("Kimi QC: no content");

  type QcRaw = {
    decision?: string;
    reason?: string;
    issues?: unknown;
    editPrompt?: string;
    regeneratedPrompt?: string;
    weightedScore?: unknown;
    scores?: {
      compositionalArchitecture?: unknown;
      lightingQuality?: unknown;
      productPresentation?: unknown;
      colorIntelligence?: unknown;
      typographyIntegration?: unknown;
      emotionalRegister?: unknown;
    };
  };
  let parsed: QcRaw;
  try {
    parsed = JSON.parse(content) as QcRaw;
  } catch {
    const block = content.match(/\{[\s\S]*\}/)?.[0];
    if (!block) throw new Error("Kimi QC: non-JSON content");
    parsed = JSON.parse(block) as QcRaw;
  }

  const scores = {
    compositionalArchitecture: clampScore(parsed.scores?.compositionalArchitecture),
    lightingQuality: clampScore(parsed.scores?.lightingQuality),
    productPresentation: clampScore(parsed.scores?.productPresentation),
    colorIntelligence: clampScore(parsed.scores?.colorIntelligence),
    typographyIntegration: clampScore(parsed.scores?.typographyIntegration),
    emotionalRegister: clampScore(parsed.scores?.emotionalRegister),
  };
  const weightedScoreFromModel = clampScore(parsed.weightedScore);
  const weightedScore =
    weightedScoreFromModel > 0 ? weightedScoreFromModel : computeWeightedPhotoAdQcScore(scores);
  const modelDecision = normalizeQcDecision(parsed.decision);
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim()).slice(0, 10)
    : [];
  const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "No reason provided";
  const editPrompt = typeof parsed.editPrompt === "string" && parsed.editPrompt.trim() ? parsed.editPrompt.trim() : undefined;
  const regeneratedPrompt =
    typeof parsed.regeneratedPrompt === "string" && parsed.regeneratedPrompt.trim() ? parsed.regeneratedPrompt.trim() : undefined;
  // Threshold policy with localized-fix exception:
  // <8.5 => regenerate
  // 8.5-9.2 => regenerate unless model explicitly marks localized issue with edit prompt
  // >9.2 => pass unless model found a meaningful issue
  let decision: PhotoAdQcDecision = modelDecision;
  if (weightedScore < 8.5) {
    decision = "regenerate";
  } else if (weightedScore <= 9.2) {
    decision = modelDecision === "edit" && Boolean(editPrompt) ? "edit" : "regenerate";
  } else {
    decision = modelDecision === "pass" ? "pass" : modelDecision;
  }

  return { decision, reason, issues, editPrompt, regeneratedPrompt, scores, weightedScore };
}

/**
 * Reviews a generated still against its intended shot and concept.
 * Returns pass/fail and concise issues to drive selective regeneration.
 */
export async function reviewGeneratedImageForShot(
  imageUrl: string,
  input: ImageShotReviewInput
): Promise<{ pass: boolean; issues: string }> {
  const dataUrl = await fetchImageAsDataUrl(imageUrl.trim());
  if (!dataUrl) {
    throw new Error("Could not fetch image for Kimi shot review");
  }

  const system = `You are a principal creative reviewer at a top national ad agency.
Your standard is ship-ready commercial quality.
Return ONLY valid JSON with exactly these keys:
- "pass": boolean
- "issues": string

Evaluation criteria:
1) Shot accuracy: matches shot type and intended subject/action.
2) Logical consistency: no contradictions with the intended scenario.
3) Product/context plausibility: visually sensible for the concept.
4) Emotional alignment: supports the shot's emotional function.
5) Safety/policy compliance: no nudity, sexualized posing, fetish cues, exposed intimate body areas, or erotic framing.
6) Professional ad quality bar: image is clear, intentional, and unambiguous enough to ship in a national campaign without confusing interpretation.

Decision rule:
- Be strict. If there is ANY meaningful issue (including ambiguity, mixed message, unclear product usage, or anything that would trigger rework at a pro agency), set "pass": false.
- Set "pass": true ONLY when the image is fully acceptable as-is for a national-quality ad shot.
- For "issues", write one concise sentence describing what must be fixed (or empty string only if truly pass).`;

  const user = `Concept summary:
${input.conceptSummary}

Target shot:
- shotNumber: ${input.shotNumber}
- shotType: ${input.shotType}
- subjectAndAction: ${input.subjectAndAction}
- emotionalFunction: ${input.emotionalFunction}
- originalPrompt: ${input.prompt}

Review the image against this target shot and return JSON only.`;

  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: user },
        ],
      },
    ],
    max_completion_tokens: 512,
    response_format: { type: "json_object" as const },
    thinking: { type: "disabled" as const },
  };

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi API: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi API: invalid JSON response");
  }

  const message = data.choices?.[0]?.message;
  const content = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!content) throw new Error("Kimi returned no content for image shot review");

  let parsed: { pass?: unknown; issues?: unknown };
  try {
    parsed = JSON.parse(content) as { pass?: unknown; issues?: unknown };
  } catch {
    // When model adds wrappers, try to extract first JSON object.
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Kimi returned non-JSON content for image shot review");
    parsed = JSON.parse(match[0]) as { pass?: unknown; issues?: unknown };
  }

  const issues = typeof parsed.issues === "string" ? parsed.issues.trim() : "";
  return {
    // Guardrail: any reported issue means this shot should be regenerated.
    pass: Boolean(parsed.pass) && issues.length === 0,
    issues,
  };
}

// --- UGC video finalize: Kimi analyzes video and returns FFmpeg params (JSON) ---

export interface FfmpegFinalizeParams {
  hqdn3d_spatial: number;
  hqdn3d_temporal: number;
  unsharp_strength: number;
  contrast: number;
  brightness: number;
  saturation: number;
}

const UGC_VIDEO_FFMPEG_SYSTEM_PROMPT = `You are a senior finishing editor and light colorist at a top-tier performance marketing agency. Your job is to watch UGC-style ad videos that are already a 7–8/10 and decide the exact FFmpeg filter parameters needed to push them to a 9–10/10 in technical quality, while keeping the authentic UGC look.

Your ONLY output will be a single JSON object of FFmpeg-style settings. No prose, no explanation, no comments.

The JSON MUST have exactly these keys and types:
{
  "hqdn3d_spatial": float,     // 0.0–3.0, spatial noise reduction strength
  "hqdn3d_temporal": float,    // 0.0–10.0, temporal noise reduction strength
  "unsharp_strength": float,   // 0.0–3.0, sharpening amount
  "contrast": float,           // 0.95–1.10, global contrast multiplier
  "brightness": float,         // -0.05–0.05, global brightness offset
  "saturation": float          // 0.90–1.20, global saturation multiplier
}

Constraints:
- Output MUST be valid JSON, parsable with a standard JSON parser.
- Do NOT include trailing commas, comments, or any extra keys.
- Do NOT output anything before or after the JSON (no backticks, no explanations).

FFmpeg filters that will use your values (for your reference):
- Denoise: hqdn3d={hqdn3d_spatial}:{hqdn3d_spatial}:{hqdn3d_temporal}:{hqdn3d_temporal}
- Sharpen: unsharp=5:5:{unsharp_strength}:5:5:0.0
- Tone/color: eq=contrast={contrast}:brightness={brightness}:saturation={saturation}

How you should think about the video:

1) Overall read and consistency
- Is the video consistently exposed and graded from start to finish, or do some parts feel noticeably darker/brighter or more/less saturated?
- Does it read clearly on a phone at a glance, or does it feel muddy, low contrast, or washed out?
- It must still feel like authentic UGC, not a hyper-stylized TV commercial.

2) Exposure and contrast → contrast, brightness
- Faces and product should be clearly visible, not buried in shadow or blown out.
- Global brightness should be appropriate for mobile viewing (not too dark, not glaringly bright).
- Contrast should give good separation between subject and background, without crushing blacks or clipping highlights.
- If the image is flat/low-contrast but not broken, set contrast around 1.02–1.06. If contrast is already strong, keep contrast near 1.00.
- If the video feels slightly too dark overall, raise brightness slightly (e.g. +0.01 to +0.03). If slightly too bright or washed, lower brightness slightly (e.g. -0.01 to -0.03).

3) Color balance and saturation → saturation
- Skin tones should not look grey, neon, or cartoonish. Overall saturation should feel natural and pleasing for an ad but not overcooked.
- If the video feels a bit dull/desaturated, set saturation around 1.05–1.15. If saturation is already strong, keep it near 1.00 or slightly below (0.95–1.0). Keep values within 0.90–1.20.

4) Noise, grain, and compression artifacts → hqdn3d_spatial, hqdn3d_temporal
- Very clean footage: hqdn3d_spatial ≈ 0.0–0.3, hqdn3d_temporal ≈ 0.0–0.5.
- Mild noise: hqdn3d_spatial ≈ 0.5–1.0, hqdn3d_temporal ≈ 1.0–2.0.
- Noticeable noise/compression: hqdn3d_spatial ≈ 1.0–2.0, hqdn3d_temporal ≈ 2.0–4.0.
- Very noisy: cap around hqdn3d_spatial 2.0–2.5, hqdn3d_temporal 4.0–6.0. Only go near upper end (3.0 / 10.0) if extremely noisy.

5) Sharpness and detail → unsharp_strength
- Already sharp/clean: unsharp_strength ≈ 0.0–0.3. Slightly soft: ≈ 0.3–1.0. Soft, low-detail: ≈ 1.0–1.8. Rarely exceed 2.0.

6) UGC authenticity constraint
- You are polishing, not making it cinematic. Do NOT push saturation so high that skin or product looks fake. Do NOT denoise so much that people look like plastic. Do NOT sharpen so much that edges have bright halos.

Your task: Inspect noise, sharpness, contrast, brightness, and color intensity across the clip. Choose values that together would take a UGC ad from 7–8 to 9–10 in perceived quality on mobile, without losing authentic feel.

Respond with ONLY the JSON object. No additional text.`;

/**
 * Send video to Kimi 2.5 for analysis; returns FFmpeg params as JSON.
 * Video is uploaded to Moonshot Files API first, then referenced as ms://file_id (required for video; raw URLs are rejected).
 */
export async function analyzeVideoForFfmpeg(videoUrl: string): Promise<FfmpegFinalizeParams> {
  const url = videoUrl.trim();
  console.log("[Kimi video] 0. analyzeVideoForFfmpeg called, videoUrl length:", url.length);

  const fileId = await uploadVideoToKimi(url);
  const videoRef = `ms://${fileId}`;

  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system", content: UGC_VIDEO_FFMPEG_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "video_url" as const, video_url: { url: videoRef } },
          { type: "text" as const, text: "Analyze this UGC ad video and return ONLY a JSON object with the six FFmpeg parameters (hqdn3d_spatial, hqdn3d_temporal, unsharp_strength, contrast, brightness, saturation). No other text." },
        ],
      },
    ],
    max_completion_tokens: 1024,
    thinking: { type: "disabled" as const },
  };

  console.log("[Kimi video] 2. Calling Kimi chat with", videoRef);
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    console.error("[Kimi video] API error:", res.status, rawBody);
    throw new Error(`Kimi API: ${res.status} ${rawBody}`);
  }

  const data = JSON.parse(rawBody) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Kimi returned no content for video analysis");

  let jsonStr = content;
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  const parsed = JSON.parse(jsonStr) as FfmpegFinalizeParams;
  const required = ["hqdn3d_spatial", "hqdn3d_temporal", "unsharp_strength", "contrast", "brightness", "saturation"];
  for (const key of required) {
    if (typeof (parsed as unknown as Record<string, unknown>)[key] !== "number") throw new Error(`Kimi video: missing or invalid "${key}"`);
  }
  return parsed;
}

// --- Ad-to-video QC: watch video and check for on-screen text spelling mistakes ---

const AD_VIDEO_TEXT_QC_SYSTEM = `You are a quality-control agent for short ad videos. Your ONLY job is to watch the video and check any on-screen text (overlays, captions, titles, lower-thirds, product names, slogans) for spelling or obvious grammar mistakes.

Rules:
- If there is NO visible text in the video, respond with: {"hasTextIssues": false}
- If there IS visible text and it is spelled correctly and grammatically fine, respond with: {"hasTextIssues": false}
- If you see any misspelled word, typo, or clear grammar error in on-screen text, respond with: {"hasTextIssues": true, "message": "Brief description of the issue (e.g. 'Misspelling: X should be Y' or 'Typo in headline')"}
- Be strict only on clear errors. Minor style choices are not issues.
- Output ONLY valid JSON. No other text, no markdown code fences.`;

export type AdVideoTextQcResult = { hasTextIssues: boolean; message?: string };

/**
 * Send ad video to Kimi; returns whether any on-screen text has spelling/grammar issues.
 * Video is uploaded to Moonshot Files API first.
 */
export async function checkAdVideoTextSpelling(videoUrl: string): Promise<AdVideoTextQcResult> {
  const url = videoUrl.trim();
  console.log("[Kimi ad-video QC] Checking text/spelling, videoUrl length:", url.length);
  const fileId = await uploadVideoToKimi(url);
  const videoRef = `ms://${fileId}`;
  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system" as const, content: AD_VIDEO_TEXT_QC_SYSTEM },
      {
        role: "user" as const,
        content: [
          { type: "video_url" as const, video_url: { url: videoRef } },
          { type: "text" as const, text: "Watch this ad video. Check all on-screen text for spelling and grammar. Reply with ONLY a JSON object: {\"hasTextIssues\": boolean, \"message\"?: string}. No other text." },
        ],
      },
    ],
    max_completion_tokens: 512,
    thinking: { type: "disabled" as const },
  };
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) {
    console.error("[Kimi ad-video QC] API error:", res.status, rawBody.slice(0, 300));
    throw new Error(`Kimi ad-video QC: ${res.status}`);
  }
  const data = JSON.parse(rawBody) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) return { hasTextIssues: false };
  let jsonStr = content;
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1]!.trim();
  try {
    const parsed = JSON.parse(jsonStr) as { hasTextIssues?: boolean; message?: string };
    const hasTextIssues = Boolean(parsed.hasTextIssues);
    console.log("[Kimi ad-video QC] Result:", hasTextIssues, parsed.message ?? "");
    return { hasTextIssues, message: parsed.message };
  } catch {
    return { hasTextIssues: false };
  }
}

// --- VPA: Editor agent – analyze all clips and return EDL (in/out points, variable durations) ---

const VPA_EDL_SYSTEM_PROMPT = `You are a professional editor at a top-tier agency. Your job is to WATCH each of the provided video clips (each is ~10 seconds) and choose the SINGLE BEST segment from each clip for the final cut.

CRITICAL — you must NOT use the start of every clip:
- Watch the FULL 0–10s of each clip. The best moment is OFTEN in the middle (e.g. 2–5s or 3–6s), not 0–2s.
- For each clip output inPointSec = the start time (in seconds) of the best segment. If the best part is from 2.5s to 5s, set inPointSec: 2.5, outPointSec: 5, durationSec: 2.5. If the best part is from 4s to 6.5s, set inPointSec: 4, outPointSec: 6.5, durationSec: 2.5.
- Only set inPointSec: 0 when the very beginning of the clip (0–durationSec) is genuinely the best moment. For most clips, the strongest moment is somewhere in the middle — use inPointSec > 0 for those.
- Choose based on: best composition/framing, peak of motion, clearest moment for the storyboard, avoiding weak start/end frames.

REQUIRED: For each clip you MUST include a short "rationale" (one line) explaining why you picked that segment, e.g. "Peak of push-in, product centered" or "Strongest framing at 3s, motion settles".

Rules:
- Clips are in order: Clip 1 = shot 1, etc. For each clip, ONE continuous segment (inPointSec to outPointSec) from anywhere in 0–10s.
- Durations vary by beat: ~1s quick cuts, 3–4s hero/brand moment. Total ~14–15s.
- Output ONLY a JSON array. Each element: { "shotNumber": number, "clipIndex": number (1-based), "inPointSec": number, "outPointSec": number, "durationSec": number, "rationale": string }. inPointSec and outPointSec in 0–10. durationSec = outPointSec - inPointSec. rationale = one-line reason for that segment.${FILM_THEORY_EDITING}`;

const VPA_REVIEW_SYSTEM_PROMPT = `You are a senior editor reviewing a cut of a ~15s product ad. You will receive (1) the assembled edit video and (2) the EDL (edit decision list) that was used to create it: for each clip, the in/out points and a short rationale.

Your tasks:
1. Watch the edit. Decide if the cut works well or if one or more segments should be changed (different in/out points).
2. If the edit is good as-is: set "approved": true and omit "suggestedEdl".
3. If you want to change one or more segments: set "approved": false and output "suggestedEdl" as a JSON array with the SAME number of entries and SAME clipIndex order. Only change inPointSec, outPointSec, durationSec (and optionally rationale) for the clips you want to fix; leave other entries unchanged. Each entry must have: shotNumber, clipIndex (1-based), inPointSec, outPointSec, durationSec, rationale.
4. Always output "musicPrompt": one short paragraph describing background music that would fit this ad (genre, mood, tempo, instrumentation). The music will be instrumental only—no vocals. Be specific (e.g. "Upbeat electronic, 120 BPM, soft synths and light percussion, confident but not aggressive").
5. Always output "voiceoverScript": short ad copy for a single voiceover that runs over the WHOLE ~15s ad. A few sentences that when read aloud take about 15 seconds. Clear, persuasive, on-brand; someone talking over the visuals for the entire ad. No stage directions or labels—just the spoken text.

Output ONLY valid JSON: { "approved": boolean, "suggestedEdl"?: array (only if approved is false), "musicPrompt": string, "voiceoverScript": string }. No other text, no markdown.${FILM_THEORY_CTA_AND_VO}`;

/** When beat grid is provided: add rules so the agent can evaluate music sync and suggest timing adjustments. */
function vpaReviewMusicSyncAddition(beatGrid: BeatGrid): string {
  const downbeatList = beatGrid.downbeats.slice(0, 40).map((t) => t.toFixed(2)).join(", ");
  const phraseList = beatGrid.phrase_boundaries.length > 0
    ? beatGrid.phrase_boundaries.slice(0, 12).map((t) => t.toFixed(2)).join(", ")
    : "(use downbeats as phrase markers)";
  return `

The edit was cut to music. Use this musical grid to evaluate sync:
- BPM: ${beatGrid.bpm}. Downbeats (beat 1 of each bar) in seconds: ${downbeatList}
- Phrase boundaries (start of each 4-bar phrase) in seconds: ${phraseList}

Cutting-to-music rules: Cuts should align to this grid—downbeats for emphasis (opening, payoff, brand moment), phrase boundaries for act transitions. Opening hook is often held for a phrase; build section cuts every bar; payoff and brand moment should land on a downbeat. If a cut in the EDL falls slightly before or after a downbeat/phrase start, suggest small timing adjustments in suggestedEdl (e.g. move inPointSec/outPointSec by ~0.05–0.15s so the cut lands on the beat). About 5 frames ≈ 0.1s at 24fps.`;
}

const VPA_MUSIC_PROMPT_SYSTEM = `You are a music supervisor for a 15-second product ad. Given a short concept and shot list, output a single paragraph describing the ideal instrumental background music. Be specific: genre, mood, tempo (BPM), instrumentation. No vocals. Output ONLY valid JSON: { "musicPrompt": string }.${FILM_THEORY_AUDIO}`;

/**
 * Get music prompt from concept + shot list (no video). Used for music-sync pipeline when we generate music before the edit.
 */
export async function getMusicPromptFromBrief(microBriefSummary: string, shotListSummary: string): Promise<string> {
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system" as const, content: VPA_MUSIC_PROMPT_SYSTEM },
        { role: "user" as const, content: `Concept: ${microBriefSummary.slice(0, 800)}\n\nShot list: ${shotListSummary.slice(0, 600)}\n\nGive one paragraph music prompt (instrumental, ~15s ad). Output JSON only: { "musicPrompt": "..." }.` },
      ],
      max_completion_tokens: 512,
      thinking: { type: "disabled" as const },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Kimi music prompt: ${res.status} ${raw.slice(0, 300)}`);
  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("Kimi music prompt: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  let parsed: { musicPrompt?: string };
  try {
    parsed = JSON.parse(jsonStr) as typeof parsed;
  } catch {
    return "Upbeat, modern, instrumental, 15 seconds, suitable for a product ad.";
  }
  return typeof parsed.musicPrompt === "string" && parsed.musicPrompt.trim()
    ? parsed.musicPrompt.trim()
    : "Upbeat, modern, instrumental, 15 seconds, suitable for a product ad.";
}

/**
 * Upload video from URL to Moonshot Files API; returns file_id for use as ms://file_id in chat.
 * Exported for use by VPA editor agent.
 */
export async function uploadVideoToKimi(videoUrl: string): Promise<string> {
  console.log("[Kimi video] 1. Downloading video from URL...");
  const res = await fetch(videoUrl.trim(), { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const mime = contentType.includes("webm") ? "video/webm" : "video/mp4";
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = videoUrl.includes(".webm") ? "video.webm" : "video.mp4";
  console.log("[Kimi video] 1. Uploading to Moonshot Files API, size:", buffer.length);
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mime }), filename);
  formData.append("purpose", "video");
  const uploadRes = await fetch(KIMI_FILES_URL, {
    method: "POST",
    headers: { Authorization: getAuthHeader() },
    body: formData,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Kimi file upload failed: ${uploadRes.status} ${err}`);
  }
  const data = (await uploadRes.json()) as { id?: string };
  if (!data.id) throw new Error("Kimi file upload: no file id in response");
  console.log("[Kimi video] 1. Uploaded, file_id:", data.id);
  return data.id;
}

export type ReviewEditResult = {
  musicPrompt: string;
  voiceoverScript?: string;
  approved: boolean;
  suggestedEdl?: EdlEntry[];
};

/**
 * VPA review agent: watch the assembled edit, optionally suggest EDL changes, and return a music prompt.
 * Uses current EDL to fill clipUrl when parsing suggestedEdl (Kimi returns indices and times only).
 * When options.beatGrid is provided, the agent receives the musical grid and evaluates whether cuts land on beats; it can suggest small timing adjustments in suggestedEdl.
 */
export async function reviewEditAndGetMusicPrompt(
  editVideoUrl: string,
  edl: EdlEntry[],
  microBriefSummary: string,
  options?: { beatGrid?: BeatGrid }
): Promise<ReviewEditResult> {
  const log = (msg: string) => console.log("[Kimi VPA Review]", msg);
  const logWarn = (msg: string) => console.warn("[Kimi VPA Review]", msg);

  log("Uploading edit video for review...");
  const fileId = await uploadVideoToKimi(editVideoUrl);
  const edlSummary = edl.map((e, i) => ({
    clipIndex: i + 1,
    shotNumber: e.shotNumber,
    inPointSec: e.inPointSec,
    outPointSec: e.outPointSec,
    durationSec: e.durationSec,
    rationale: e.rationale ?? "",
  }));
  let userText = `Concept summary: ${microBriefSummary.slice(0, 500)}

EDL used for this cut (each segment was chosen for the reason in rationale):
${JSON.stringify(edlSummary, null, 2)}

Video: ms://${fileId}

Watch the edit. If it works well, set approved: true and omit suggestedEdl. If you want to change one or more segments, set approved: false and output suggestedEdl with the same structure (same clipIndex order); only change inPointSec/outPointSec/durationSec for the clips you want to fix. Always output musicPrompt: one paragraph describing instrumental background music that fits this ad. Always output voiceoverScript: the spoken copy for a single voiceover over the whole ~15s ad (a few sentences, ~15 seconds when read aloud).`;
  if (options?.beatGrid && options.beatGrid.beats.length > 0) {
    userText += vpaReviewMusicSyncAddition(options.beatGrid);
    log("Including beat grid for music-sync evaluation.");
  }
  userText += `

Output ONLY valid JSON: { "approved": boolean, "suggestedEdl"?: array, "musicPrompt": string, "voiceoverScript": string }. No other text.`;

  const payload = {
    model: KIMI_MODEL,
    messages: [
      { role: "system" as const, content: VPA_REVIEW_SYSTEM_PROMPT },
      { role: "user" as const, content: [{ type: "text" as const, text: userText }, { type: "video_url" as const, video_url: { url: `ms://${fileId}` } }] },
    ],
    max_completion_tokens: 2048,
    thinking: { type: "disabled" as const },
  };

  log("Calling Kimi for review + music prompt...");
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const rawBody = await res.text();
  if (!res.ok) {
    logWarn(`Kimi review API error: ${res.status}`);
    throw new Error(`Kimi review: ${res.status} ${rawBody.slice(0, 300)}`);
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi review: invalid JSON response");
  }
  let text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi review: no content in response");

  let jsonStr = text;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1]!.trim();

  let parsed: { approved?: boolean; suggestedEdl?: Array<{ shotNumber?: number; clipIndex?: number; inPointSec?: number; outPointSec?: number; durationSec?: number; rationale?: string }>; musicPrompt?: string; voiceoverScript?: string };
  try {
    parsed = JSON.parse(jsonStr) as typeof parsed;
  } catch (e) {
    console.error("[Kimi VPA Review] JSON parse failed", e);
    throw new Error("Kimi review: response is not valid JSON");
  }

  const approved = parsed.approved === true;
  const musicPrompt = typeof parsed.musicPrompt === "string" && parsed.musicPrompt.trim()
    ? parsed.musicPrompt.trim()
    : "Upbeat, modern, instrumental, 15 seconds, suitable for a product ad.";
  const voiceoverScript = typeof parsed.voiceoverScript === "string" && parsed.voiceoverScript.trim()
    ? parsed.voiceoverScript.trim()
    : undefined;

  let suggestedEdl: EdlEntry[] | undefined;
  if (!approved && Array.isArray(parsed.suggestedEdl) && parsed.suggestedEdl.length === edl.length) {
    suggestedEdl = parsed.suggestedEdl.map((e, i) => {
      const clipIndex = Math.max(1, Math.min(edl.length, Number(e.clipIndex) ?? i + 1));
      const existing = edl[clipIndex - 1]!;
      const rawIn = Number(e.inPointSec);
      const inPointSec = Number.isFinite(rawIn) ? Math.max(0, Math.min(10, rawIn)) : existing.inPointSec;
      const durationSec = Math.max(0.5, Number(e.durationSec) ?? (Number(e.outPointSec) != null ? Math.max(0, Number(e.outPointSec) - inPointSec) : existing.durationSec));
      const outPointSec = inPointSec + durationSec;
      const rationale = typeof e.rationale === "string" && e.rationale.trim() ? e.rationale.trim() : existing.rationale;
      return {
        shotNumber: Number(e.shotNumber) ?? existing.shotNumber,
        clipUrl: existing.clipUrl,
        inPointSec,
        outPointSec,
        durationSec,
        rationale,
      };
    });
    log("Parsed suggestedEdl; will re-run edit assembly.");
  } else if (!approved && Array.isArray(parsed.suggestedEdl) && parsed.suggestedEdl.length > 0) {
    logWarn("suggestedEdl length mismatch or invalid; ignoring.");
  }

  log(`Review done: approved=${approved}, musicPrompt length=${musicPrompt.length}, voiceoverScript: ${voiceoverScript ? "yes" : "no"}`);
  return { musicPrompt, voiceoverScript, approved, suggestedEdl };
}

/** VPA editor agent: watch all clips, return EDL with variable in/out and durations. Logs everything for debugging. */
export async function analyzeClipsForEdl(
  clipUrls: string[],
  shotList: ShotListEntry[],
  microBriefSummary: string
): Promise<EdlEntry[]> {
  const n = clipUrls.length;
  const log = (msg: string, detail?: unknown) => {
    console.log("[Kimi VPA EDL]", msg);
    if (detail !== undefined) console.log("[Kimi VPA EDL]", typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  };
  const logWarn = (msg: string) => console.warn("[Kimi VPA EDL]", msg);
  const logErr = (msg: string, err?: unknown) => {
    console.error("[Kimi VPA EDL]", msg);
    if (err !== undefined) console.error("[Kimi VPA EDL] error detail:", err);
  };

  if (n === 0) {
    log("No clips — returning empty EDL");
    return [];
  }

  try {
    log(`Starting: ${n} clips, storyboard summary length ${microBriefSummary.length}`);
    log("Uploading clips...");
    const fileIds: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      try {
        const id = await uploadVideoToKimi(clipUrls[i]!);
        fileIds.push(id);
        log(`Clip ${i + 1}/${n} uploaded, file_id: ${id}`);
      } catch (e) {
        logErr(`Upload failed for clip ${i + 1}`, e);
        throw e;
      }
    }
    log("All uploads done", fileIds);

    const videoRefs = fileIds.map((id, i) => `Clip ${i + 1}: ms://${id}`).join("\n");
    const shotListStr = JSON.stringify(
      shotList.map((s) => ({
        shotNumber: s.shotNumber,
        shotType: s.shotType,
        subjectAndAction: s.subjectAndAction,
        cameraMove: s.cameraMove,
        durationSec: s.durationSec,
        emotionalFunction: s.emotionalFunction,
      }))
    );
    const userText = `Storyboard / concept: ${microBriefSummary.slice(0, 1500)}

Shot list (intended pacing and content):
${shotListStr}

Videos (in order): ${videoRefs}

Watch the FULL 0–10 seconds of each clip. For each clip, choose the BEST continuous segment: set inPointSec to the start time (seconds) where that segment begins, and outPointSec where it ends. Example: if the best part of clip 2 is from 2.0s to 4.5s, use "inPointSec": 2, "outPointSec": 4.5, "durationSec": 2.5, "rationale": "Best framing and motion here.". Do NOT use inPointSec: 0 for every clip — only when the very start is truly the best. For most clips the best moment is in the middle (e.g. 1.5–4s or 3–6s). Total edit ~14–15s. Apply cutting-on-action (cut at peak of movement) and act-based pacing: fast cuts for hook (1–2s), medium for build (2–4s), slower holds for payoff and brand moment (3–5s).

Output ONLY a JSON array. Each object MUST include: shotNumber, clipIndex (1-based), inPointSec, outPointSec, durationSec, rationale (one line per clip). No other text.`;

    const content: Array<{ type: "video_url"; video_url: { url: string } } | { type: "text"; text: string }> = [
      { type: "text" as const, text: userText },
    ];
    fileIds.forEach((id) => content.push({ type: "video_url" as const, video_url: { url: `ms://${id}` } }));

    const payload = {
      model: KIMI_MODEL,
      messages: [
        { role: "system" as const, content: VPA_EDL_SYSTEM_PROMPT },
        { role: "user" as const, content },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    };
    log("Request payload (no secrets)", { model: payload.model, messageCount: payload.messages.length, contentParts: content.length });

    log("Calling Kimi chat/completions...");
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await res.text();
    log("Response status", res.status);
    log("Response body length", rawBody.length);
    if (rawBody.length <= 2000) {
      log("Response body (full)", rawBody);
    } else {
      log("Response body (first 1500 chars)", rawBody.slice(0, 1500));
      log("Response body (last 800 chars)", rawBody.slice(-800));
    }
    if (!res.ok) {
      logErr("API error", { status: res.status, body: rawBody.slice(0, 500) });
      throw new Error(`Kimi API (VPA EDL): ${res.status} ${rawBody}`);
    }

    let data: { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch (parseErr) {
      logErr("Response JSON parse failed", parseErr);
      throw new Error("Kimi VPA EDL: invalid JSON response");
    }
    let text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text && data.choices?.[0]?.message?.reasoning_content) {
      const reasoning = String(data.choices[0].message.reasoning_content).trim();
      log("Using reasoning_content as fallback (content empty)", reasoning.length);
      const paragraphs = reasoning.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      text = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1]! : reasoning;
    }
    if (!text) {
      logErr("No content in response", { choices: data.choices?.length, firstChoice: data.choices?.[0] });
      throw new Error("Kimi VPA EDL: no content in response");
    }

    let jsonStr = text;
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      jsonStr = codeBlock[1]!.trim();
      log("Extracted JSON from code block");
    }
    type EdlRaw = { shotNumber?: number; clipIndex?: number; inPointSec?: number; outPointSec?: number; durationSec?: number; rationale?: string };
    let arr: EdlRaw[];
    try {
      arr = JSON.parse(jsonStr) as EdlRaw[];
    } catch (parseErr) {
      logErr("EDL JSON parse failed", parseErr);
      log("Raw string that failed to parse", jsonStr.slice(0, 500));
      throw new Error("Kimi VPA EDL: response is not valid JSON");
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      logErr("EDL is not a non-empty array", { isArray: Array.isArray(arr), length: arr?.length });
      throw new Error("Kimi VPA EDL: response is not a non-empty array");
    }

    log("Parsed EDL array length", arr.length);
      arr.forEach((e, i) => {
      log(`Entry ${i + 1}: clipIndex=${e.clipIndex} inPointSec=${e.inPointSec} outPointSec=${e.outPointSec} durationSec=${e.durationSec} rationale=${e.rationale ?? "(missing)"}`);
    });

    const edl: EdlEntry[] = arr.map((e) => {
    const clipIndex = Math.max(1, Math.min(n, Number(e.clipIndex) || 1));
    const shotNumber = Number(e.shotNumber) || clipIndex;
    const rawIn = Number(e.inPointSec);
    const inPointSec = Number.isFinite(rawIn) ? Math.max(0, Math.min(10, rawIn)) : 0;
    const durationSec = Math.max(0.5, Number(e.durationSec) || (Number(e.outPointSec) != null ? Math.max(0, Number(e.outPointSec) - inPointSec) : 1.5));
    const outPointSec = inPointSec + durationSec;
    const rationale = typeof e.rationale === "string" && e.rationale.trim() ? e.rationale.trim() : undefined;
    if (!rationale) logWarn(`Clip ${clipIndex} has no rationale from Kimi`);
    return {
      shotNumber,
      clipUrl: clipUrls[clipIndex - 1]!,
      inPointSec,
      outPointSec,
      durationSec,
      rationale,
    };
    });

    const inPoints = edl.map((e) => e.inPointSec).join(", ");
    log("Parsed EDL", { count: edl.length, inPointSecPerClip: inPoints });
    edl.forEach((e, i) => {
      log(`Clip ${i + 1}: in=${e.inPointSec}s dur=${e.durationSec}s — ${e.rationale ?? "(no rationale)"}`);
    });
    if (edl.every((e) => e.inPointSec === 0)) {
      logWarn("All inPointSec are 0 — model may have ignored instruction to pick best segment from within each clip.");
    }

    log("analyzeClipsForEdl done");
    return edl;
  } catch (e) {
    logErr("analyzeClipsForEdl failed", e);
    throw e;
  }
}

const VPA_CLIP_PROFILES_SYSTEM = `You are a professional film editor analyzing video clips for a 15-second commercial. For each clip you will receive, output one JSON object with: clipIndex (1-based), peak_action_moment (seconds — exact timecode where the most visually dynamic moment occurs), entry_energy (1-10), exit_energy (1-10), motion_direction (one of: left, right, up, down, toward camera, away from camera, static), best_window_start (seconds), best_window_end (seconds — best usable segment), emotional_quality (one word). Output a JSON array with one object per clip in order. Only the array, no other text.${FILM_THEORY_CLIP_PROFILES_NOTE}`;

/**
 * Analyze each clip for music-sync cut decision: peak action, energy, motion, best window.
 */
export async function analyzeClipsForMusicSync(
  clipUrls: string[],
  shotList: ShotListEntry[],
  microBriefSummary: string
): Promise<ClipProfile[]> {
  const n = clipUrls.length;
  if (n === 0) return [];
  const log = (msg: string) => console.log("[Kimi VPA ClipProfiles]", msg);
  try {
    log(`Uploading ${n} clips...`);
    const fileIds: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      const id = await uploadVideoToKimi(clipUrls[i]!);
      fileIds.push(id);
    }
    const shotListStr = JSON.stringify(shotList.map((s) => ({ shotNumber: s.shotNumber, shotType: s.shotType, emotionalFunction: s.emotionalFunction, durationSec: s.durationSec })));
    const userParts: Array<{ type: "text"; text: string } | { type: "video_url"; video_url: { url: string } }> = [
      { type: "text" as const, text: `Concept: ${microBriefSummary.slice(0, 500)}\nShot list: ${shotListStr}\n\nVideos in order (Clip 1 to ${n}). For each clip, provide: clipIndex, peak_action_moment (seconds), entry_energy (1-10), exit_energy (1-10), motion_direction, best_window_start, best_window_end, emotional_quality. Output ONLY a JSON array of ${n} objects, one per clip.` },
    ];
    fileIds.forEach((id) => userParts.push({ type: "video_url" as const, video_url: { url: `ms://${id}` } }));
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: "system" as const, content: VPA_CLIP_PROFILES_SYSTEM },
          { role: "user" as const, content: userParts },
        ],
        max_completion_tokens: 2048,
        thinking: { type: "disabled" as const },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Kimi clip profiles: ${res.status}`);
    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error("Kimi clip profiles: invalid response JSON");
    }
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Kimi clip profiles: no content in response");
    let jsonStr = text;
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (block) jsonStr = block[1]!.trim();
    const arr = JSON.parse(jsonStr) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr) || arr.length < n) throw new Error("Kimi clip profiles: invalid or short array");
    const profiles: ClipProfile[] = arr.slice(0, n).map((o, i) => ({
      clipIndex: i + 1,
      peak_action_moment: Math.max(0, Math.min(10, Number(o.peak_action_moment) || 1)),
      entry_energy: Math.max(1, Math.min(10, Number(o.entry_energy) || 5)),
      exit_energy: Math.max(1, Math.min(10, Number(o.exit_energy) || 5)),
      motion_direction: typeof o.motion_direction === "string" ? o.motion_direction : "static",
      best_window_start: Math.max(0, Math.min(10, Number(o.best_window_start) || 0)),
      best_window_end: Math.max(0, Math.min(10, Number(o.best_window_end) || 3)),
      emotional_quality: typeof o.emotional_quality === "string" ? o.emotional_quality : "neutral",
    }));
    log(`Got ${profiles.length} clip profiles`);
    return profiles;
  } catch (e) {
    console.warn("[Kimi VPA ClipProfiles] failed:", e instanceof Error ? e.message : e);
    throw e;
  }
}

type SocialStrategyInput = {
  productInfo: string;
  objective: string;
  targetAudience: string;
  cadencePerWeek: number;
  platforms: Array<"instagram-feed" | "instagram-story" | "facebook-feed" | "pinterest" | "tiktok-cover" | "x">;
  timezone: string;
};

type SocialStrategySlot = {
  platform: "instagram-feed" | "instagram-story" | "facebook-feed" | "pinterest" | "tiktok-cover" | "x";
  post_type:
    | "awareness"
    | "lifestyle"
    | "educational"
    | "social-proof"
    | "product-hero"
    | "behind-scenes"
    | "promotional"
    | "brand-values"
    | "ugc-style";
  title: string;
  purpose: string;
  brief: string;
  scheduled_for: string;
  visual_mode?: "photography" | "gradient-text" | "graphic-design";
  hook?: string;
  engagement_idea?: string;
};

export type SocialStrategyResult = {
  mix: Array<{ post_type: SocialStrategySlot["post_type"]; percentage: number; rationale: string }>;
  slots: SocialStrategySlot[];
  research: {
    product_summary: string;
    audience_insights: string[];
    engagement_angles: string[];
  };
};

export type SocialCaptionCandidate = {
  caption: string;
  hashtags: string[];
  firstComment?: string;
  altText?: string;
  model?: string;
  prompt?: Record<string, unknown>;
  qualityScore?: number;
};

function normalizeSocialStrategyPostType(value: unknown): SocialStrategySlot["post_type"] {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (s === "socialproof") return "social-proof";
  if (s === "producthero") return "product-hero";
  if (s === "behindscenes") return "behind-scenes";
  if (s === "ugc") return "ugc-style";
  if (
    s === "awareness" ||
    s === "lifestyle" ||
    s === "educational" ||
    s === "social-proof" ||
    s === "product-hero" ||
    s === "behind-scenes" ||
    s === "promotional" ||
    s === "brand-values" ||
    s === "ugc-style"
  ) {
    return s;
  }
  return "lifestyle";
}

function normalizeSocialStrategyPlatform(value: unknown): SocialStrategySlot["platform"] {
  const s = String(value ?? "").trim();
  if (
    s === "instagram-feed" ||
    s === "instagram-story" ||
    s === "facebook-feed" ||
    s === "pinterest" ||
    s === "tiktok-cover" ||
    s === "x"
  ) {
    return s;
  }
  return "instagram-feed";
}

function inferVisualModeForPostType(postType: SocialStrategySlot["post_type"]): "photography" | "gradient-text" | "graphic-design" {
  if (postType === "educational" || postType === "brand-values" || postType === "awareness") return "gradient-text";
  if (postType === "social-proof" || postType === "promotional") return "graphic-design";
  return "photography";
}

function normalizeSocialVisualMode(value: unknown, postType: SocialStrategySlot["post_type"]): "photography" | "gradient-text" | "graphic-design" {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "photography" || s === "gradient-text" || s === "graphic-design") return s;
  return inferVisualModeForPostType(postType);
}

function fallbackSocialStrategyPlan(input: SocialStrategyInput): SocialStrategyResult {
  const mix: SocialStrategyResult["mix"] = [
    { post_type: "lifestyle", percentage: 20, rationale: "Build daily relevance and aspiration." },
    { post_type: "educational", percentage: 20, rationale: "Answer what buyers want to know before they buy." },
    { post_type: "social-proof", percentage: 15, rationale: "Build trust through specific proof moments." },
    { post_type: "product-hero", percentage: 15, rationale: "Reinforce product desirability." },
    { post_type: "behind-scenes", percentage: 10, rationale: "Humanize the brand story and process." },
    { post_type: "promotional", percentage: 10, rationale: "Create timely action for ready buyers." },
    { post_type: "brand-values", percentage: 5, rationale: "Strengthen brand affinity beyond features." },
    { post_type: "ugc-style", percentage: 5, rationale: "Add native-feeling authenticity." },
  ];

  const total = Math.max(1, Math.min(31, input.cadencePerWeek));
  const today = new Date();
  const postTypes = mix.flatMap((m) => Array(Math.max(1, Math.round((m.percentage / 100) * total))).fill(m.post_type));
  while (postTypes.length < total) postTypes.push("lifestyle");
  const trimmed = postTypes.slice(0, total);

  const slots: SocialStrategySlot[] = trimmed.map((postType, idx) => {
    const platform = input.platforms[idx % input.platforms.length]!;
    const date = new Date(today);
    date.setDate(today.getDate() + idx);
    const dateIso = `${date.toISOString().slice(0, 10)}T10:00:00.000Z`;
    const idea =
      postType === "educational"
        ? "Explain one specific feature and why it matters in everyday use."
        : postType === "social-proof"
          ? "Highlight one believable proof point customers care about."
          : postType === "promotional"
            ? "Frame one clear offer in a native social way."
            : postType === "behind-scenes"
              ? "Show a real process/detail behind how quality is created."
              : "Show a relatable moment that makes the product feel useful now.";
    return {
      platform,
      post_type: postType,
      title: `${postType.replace("-", " ")} angle ${idx + 1}`,
      purpose: `Drive ${input.objective || "engagement"} with a concrete post idea.`,
      brief: `${idea} Product context: ${input.productInfo.slice(0, 220)}. Audience: ${input.targetAudience || "general buyers"}.`,
      visual_mode: inferVisualModeForPostType(postType),
      hook: postType === "educational" ? "What most people miss:" : "Worth knowing:",
      engagement_idea: idea,
      scheduled_for: dateIso,
    };
  });

  return {
    mix,
    slots,
    research: {
      product_summary: input.productInfo.slice(0, 280),
      audience_insights: [
        `Audience: ${input.targetAudience || "general buyers"}`,
        `Objective: ${input.objective || "engagement"}`,
      ],
      engagement_angles: [
        "Answer a common buyer question.",
        "Show product in a real-life moment.",
        "Provide one clear proof signal.",
      ],
    },
  };
}

export async function generateSocialStrategyPlan(input: SocialStrategyInput): Promise<SocialStrategyResult> {
  if (!isKimiConfigured()) return fallbackSocialStrategyPlan(input);

  const total = Math.max(1, Math.min(31, input.cadencePerWeek));
  const start = new Date();
  const startDate = start.toISOString().slice(0, 10);
  const payload = {
    model: KIMI_MODEL,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a senior social strategist for ecommerce brands. Build idea-first social plans where each post has a clear engagement idea tied to audience psychology.",
      },
      {
        role: "user" as const,
        content: `Create a social strategy plan in valid JSON only.

Inputs:
- productInfo: ${input.productInfo}
- objective: ${input.objective}
- targetAudience: ${input.targetAudience || "general buyers"}
- cadencePerWeek (slot count): ${total}
- platforms: ${input.platforms.join(", ")}
- timezone: ${input.timezone}
- start_date_utc: ${startDate}

Rules:
- Every slot must have a specific engagement idea (not generic wording).
- Titles must be concrete and non-repetitive (avoid "post 1" naming).
- Post types allowed: awareness,lifestyle,educational,social-proof,product-hero,behind-scenes,promotional,brand-values,ugc-style
- Each slot platform must be one of provided platforms.
- scheduled_for must be ISO UTC time around 10:00:00.000Z and increment day-by-day from start_date_utc.
- Ensure mix percentages roughly sum to 100 and reflect objective + audience.
- Assign a visual_mode per slot from: photography, gradient-text, graphic-design.
- Use gradient-text for stat/opinion/question posts, graphic-design for list/comparison/review cards, photography for lifestyle/story moments.

Return JSON with this shape only:
{
  "research": {
    "product_summary": "string",
    "audience_insights": ["string"],
    "engagement_angles": ["string"]
  },
  "mix": [
    { "post_type": "lifestyle", "percentage": 20, "rationale": "string" }
  ],
  "slots": [
    {
      "platform": "instagram-feed",
      "post_type": "educational",
      "title": "string",
      "purpose": "string",
      "brief": "string",
      "visual_mode": "gradient-text",
      "hook": "string",
      "engagement_idea": "string",
      "scheduled_for": "2026-03-02T10:00:00.000Z"
    }
  ]
}`,
      },
    ],
    max_completion_tokens: 4096,
    thinking: { type: "disabled" as const },
  };

  try {
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Kimi social strategy: ${res.status} ${raw}`);
    const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Kimi social strategy: empty response content");
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const json = JSON.parse(block ? block[1]!.trim() : text) as {
      research?: { product_summary?: string; audience_insights?: string[]; engagement_angles?: string[] };
      mix?: Array<{ post_type?: unknown; percentage?: unknown; rationale?: unknown }>;
      slots?: Array<Record<string, unknown>>;
    };

    const fallback = fallbackSocialStrategyPlan(input);
    const mix = Array.isArray(json.mix) && json.mix.length > 0
      ? json.mix.slice(0, 12).map((m) => ({
          post_type: normalizeSocialStrategyPostType(m.post_type),
          percentage: Math.max(1, Math.min(80, Number(m.percentage ?? 0) || 1)),
          rationale: typeof m.rationale === "string" && m.rationale.trim() ? m.rationale.trim() : "Supports engagement and conversion goals.",
        }))
      : fallback.mix;

    const slots: SocialStrategySlot[] = Array.isArray(json.slots) && json.slots.length > 0
      ? json.slots.slice(0, total).map((slot, idx) => {
          const date = new Date(start);
          date.setDate(start.getDate() + idx);
          const fallbackDate = `${date.toISOString().slice(0, 10)}T10:00:00.000Z`;
          return {
            platform: normalizeSocialStrategyPlatform(slot.platform),
            post_type: normalizeSocialStrategyPostType(slot.post_type),
            title:
              typeof slot.title === "string" && slot.title.trim()
                ? slot.title.trim()
                : `${normalizeSocialStrategyPostType(slot.post_type).replace("-", " ")} angle ${idx + 1}`,
            purpose:
              typeof slot.purpose === "string" && slot.purpose.trim()
                ? slot.purpose.trim()
                : "Drive engagement with a specific content idea.",
            brief:
              typeof slot.brief === "string" && slot.brief.trim()
                ? slot.brief.trim()
                : `Create a social post for ${input.productInfo.slice(0, 180)}.`,
            visual_mode: normalizeSocialVisualMode(slot.visual_mode, normalizeSocialStrategyPostType(slot.post_type)),
            hook: typeof slot.hook === "string" ? slot.hook.trim() : undefined,
            engagement_idea:
              typeof slot.engagement_idea === "string" && slot.engagement_idea.trim()
                ? slot.engagement_idea.trim()
                : undefined,
            scheduled_for:
              typeof slot.scheduled_for === "string" && slot.scheduled_for.trim() ? slot.scheduled_for.trim() : fallbackDate,
          };
        })
      : fallback.slots;

    const research = {
      product_summary:
        typeof json.research?.product_summary === "string" && json.research.product_summary.trim()
          ? json.research.product_summary.trim()
          : fallback.research.product_summary,
      audience_insights: Array.isArray(json.research?.audience_insights)
        ? json.research!.audience_insights!.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 8)
        : fallback.research.audience_insights,
      engagement_angles: Array.isArray(json.research?.engagement_angles)
        ? json.research!.engagement_angles!.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 8)
        : fallback.research.engagement_angles,
    };

    while (slots.length < total) {
      const next = fallback.slots[slots.length % fallback.slots.length]!;
      slots.push({ ...next, scheduled_for: `${new Date(Date.now() + slots.length * 86400000).toISOString().slice(0, 10)}T10:00:00.000Z` });
    }
    return { mix, slots: slots.slice(0, total), research };
  } catch (e) {
    console.warn("[Kimi] social strategy fallback:", e instanceof Error ? e.message : e);
    return fallbackSocialStrategyPlan(input);
  }
}

type SocialImagePromptInput = {
  platform: string;
  postType: string;
  title: string;
  brief: string;
  productInfo: string;
};

export async function generateSocialImagePrompt(input: SocialImagePromptInput): Promise<string> {
  const platformHints: Record<string, string> = {
    "instagram-feed": "Square feed composition, clean focal point, low text density.",
    "instagram-story": "Vertical story composition, text-safe zones top and bottom.",
    "facebook-feed": "Feed-friendly composition with slightly wider framing.",
    pinterest: "Vertical discovery format with space for tasteful text overlays.",
    "tiktok-cover": "High-contrast static thumbnail aesthetic, clear focal subject.",
    x: "Fast-scannable social visual with concise message area.",
  };
  return [
    "Generate an authentic brand social post image.",
    `Platform intent: ${platformHints[input.platform] ?? "General social feed composition."}`,
    `Post type: ${input.postType}.`,
    `Title direction: ${input.title || "Brand-led social content"}.`,
    `Creative brief: ${input.brief || "Create an engaging social visual."}`,
    `Product context: ${input.productInfo || "Product details not provided."}`,
    "Style: photorealistic, modern, high-quality, naturally lit, clean composition.",
    "Avoid heavy ad-like text overlays; keep it social-native and engagement-friendly.",
  ].join("\n");
}

type SocialCaptionInput = {
  platform: string;
  postType: string;
  title: string;
  hook?: string;
  purpose: string;
  brief: string;
  productInfo: string;
  count: number;
};

type SocialIdeaInput = {
  platform: string;
  postType: string;
  productInfo: string;
  objective: string;
  targetAudience: string;
  researchSummary?: string;
  audienceInsights?: string[];
  engagementAngles?: string[];
  currentTitle?: string;
  currentPurpose?: string;
  currentBrief?: string;
};

export type SocialIdeaResult = {
  title: string;
  purpose: string;
  brief: string;
  hook: string;
  engagementIdea: string;
};

function fallbackSocialIdea(input: SocialIdeaInput): SocialIdeaResult {
  const postType = input.postType;
  const idea =
    postType === "educational"
      ? "Teach one specific tip most users overlook and why it matters."
      : postType === "social-proof"
        ? "Highlight one real proof signal that reduces buying hesitation."
        : postType === "promotional"
          ? "Present one timely offer in a native social tone."
          : postType === "behind-scenes"
            ? "Show one concrete behind-the-scenes process detail."
            : "Tell one relatable story moment that fits audience daily life.";
  return {
    title: `${postType.replace("-", " ")} topic`,
    purpose: `Drive ${input.objective || "engagement"} with a specific social topic.`,
    brief: `${idea} Product context: ${(input.researchSummary || input.productInfo).slice(0, 260)}. Audience: ${input.targetAudience || "general buyers"}. Platform: ${input.platform}.`,
    hook: postType === "educational" ? "Most people miss this:" : "Quick take:",
    engagementIdea: idea,
  };
}

export async function generateSocialIdeaBrief(input: SocialIdeaInput): Promise<SocialIdeaResult> {
  if (!isKimiConfigured()) return fallbackSocialIdea(input);
  const payload = {
    model: KIMI_MODEL,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a senior social media manager. Generate one high-quality post idea that prioritizes engagement topics and audience relevance over ad copy.",
      },
      {
        role: "user" as const,
        content: `Return valid JSON only with keys: title, purpose, brief, hook, engagementIdea.

Context:
- platform: ${input.platform}
- postType: ${input.postType}
- objective: ${input.objective || "engagement"}
- targetAudience: ${input.targetAudience || "general buyers"}
- productInfo: ${input.productInfo}
- researchSummary: ${input.researchSummary || "n/a"}
- audienceInsights: ${(input.audienceInsights ?? []).join(" | ") || "n/a"}
- engagementAngles: ${(input.engagementAngles ?? []).join(" | ") || "n/a"}
- currentTitle: ${input.currentTitle || "n/a"}
- currentPurpose: ${input.currentPurpose || "n/a"}
- currentBrief: ${input.currentBrief || "n/a"}

Requirements:
- Idea must be specific and conversation-worthy.
- Avoid generic labels like "post 1" or "lifestyle post".
- Title max ~10 words.
- Purpose 1 sentence (why this post should exist).
- Brief 2-4 sentences with concrete direction for visual + caption.
- Hook should be a short opener that can start caption text.
- Must align with the audience and platform behavior.`,
      },
    ],
    max_completion_tokens: 800,
    thinking: { type: "disabled" as const },
  };
  try {
    const res = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Kimi social idea: ${res.status} ${raw}`);
    const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Kimi social idea: empty content");
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const json = JSON.parse(block ? block[1]!.trim() : text) as Partial<SocialIdeaResult>;
    const fallback = fallbackSocialIdea(input);
    return {
      title: typeof json.title === "string" && json.title.trim() ? json.title.trim().slice(0, 120) : fallback.title,
      purpose: typeof json.purpose === "string" && json.purpose.trim() ? json.purpose.trim() : fallback.purpose,
      brief: typeof json.brief === "string" && json.brief.trim() ? json.brief.trim() : fallback.brief,
      hook: typeof json.hook === "string" && json.hook.trim() ? json.hook.trim().slice(0, 120) : fallback.hook,
      engagementIdea:
        typeof json.engagementIdea === "string" && json.engagementIdea.trim()
          ? json.engagementIdea.trim()
          : fallback.engagementIdea,
    };
  } catch (e) {
    console.warn("[Kimi] social idea fallback:", e instanceof Error ? e.message : e);
    return fallbackSocialIdea(input);
  }
}

export async function generateSocialCaptionCandidates(input: SocialCaptionInput): Promise<SocialCaptionCandidate[]> {
  const platformTone: Record<string, string> = {
    "instagram-feed": "warm, concise, save-worthy",
    "instagram-story": "casual, tap-through, direct",
    "facebook-feed": "conversational and slightly longer",
    pinterest: "keyword-rich and evergreen",
    "tiktok-cover": "punchy and high-energy",
    x: "very concise with a strong hook",
  };
  const tone = platformTone[input.platform] ?? "engaging and concise";
  const baseHash = ["#brand", "#social", "#creator", "#discover"];

  const makeOne = (idx: number): SocialCaptionCandidate => {
    const hookPrefix =
      input.postType === "educational"
        ? "Quick tip:"
        : input.postType === "promotional"
        ? "Limited-time angle:"
        : input.postType === "social-proof"
        ? "People keep saying this:"
        : "Today’s post:";
    const caption = `${input.hook?.trim() ? `${input.hook.trim()} ` : ""}${hookPrefix} ${input.title || "A new way to think about this product"}. ${input.purpose || input.brief || "Designed to drive engagement."} Tone: ${tone}.`;
    const hashtags = [...baseHash, `#${input.postType.replace(/[^a-z0-9]/gi, "")}`, `#${input.platform.replace(/[^a-z0-9]/gi, "")}`];
    return {
      caption,
      hashtags,
      firstComment: `Which version do you want next: lifestyle, educational, or social proof?`,
      altText: `Social image for ${input.postType} content featuring ${input.productInfo.slice(0, 100) || "a featured product"}.`,
      model: "kimi-k2.5",
      prompt: {
        platform: input.platform,
        postType: input.postType,
        tone,
      },
      qualityScore: Math.max(8.2, 9.4 - idx * 0.2),
    };
  };

  return Array.from({ length: Math.max(1, Math.min(5, input.count)) }, (_, idx) => makeOne(idx));
}

/** Structured breakdown of a competitor ad for the Winning Ad Breakdown feature. */
export type AdBreakdownResult = {
  hookAnalysis: string;
  painPointTargeted: string;
  offerClarity: string;
  trustSignalsUsed: string;
  ctaStrength: string;
  whatToSteal: string[];
  overallScore: number;
  overallExplanation: string;
};

const AD_BREAKDOWN_SYSTEM_PROMPT = `You are an expert ad strategist. Analyze the provided ad (image and/or copy) and produce a structured strategic breakdown so a marketer can learn why it works and apply those tactics.

Output valid JSON only, with these exact keys:
- "hookAnalysis": string — what the opening line or visual is doing, why it stops the scroll, what emotion or curiosity it triggers.
- "painPointTargeted": string — what customer problem this ad is speaking to.
- "offerClarity": string — how clearly the value proposition is communicated and how strong it is.
- "trustSignalsUsed": string — social proof, reviews, guarantees, numbers mentioned.
- "ctaStrength": string — how compelling the call to action is and why.
- "whatToSteal": array of 3–4 strings — specific tactical takeaways the user can apply to their own ads.
- "overallScore": number 1–10 — single number.
- "overallExplanation": string — one sentence explaining the score.

No markdown, no code fence, no commentary. Only the JSON object.`;

export async function analyzeAdBreakdown(params: {
  adCopy?: string;
  imageUrl?: string;
  videoUrl?: string;
  advertiserName?: string;
}): Promise<AdBreakdownResult> {
  const { adCopy, imageUrl, videoUrl, advertiserName } = params;
  if (!adCopy?.trim() && !imageUrl?.trim()) {
    throw new Error("At least one of adCopy or imageUrl is required");
  }

  const parts: string[] = [];
  if (advertiserName?.trim()) parts.push(`Advertiser: ${advertiserName.trim()}`);
  if (adCopy?.trim()) parts.push(`Ad copy:\n${adCopy.trim()}`);
  if (videoUrl?.trim()) parts.push(`(This ad also has video; analyze the copy and any provided image.)`);
  const userText = parts.join("\n\n") || "Analyze this ad.";

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userText },
  ];
  if (imageUrl?.trim()) {
    const dataUrl = await fetchImageAsDataUrl(imageUrl.trim());
    if (dataUrl) content.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: AD_BREAKDOWN_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi ad breakdown: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi ad breakdown: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi ad breakdown: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kimi ad breakdown: response is not valid JSON");
  }
  const o = parsed as Record<string, unknown>;
  const overallScore = typeof o.overallScore === "number" ? o.overallScore : Number(o.overallScore) || 7;
  return {
    hookAnalysis: String(o.hookAnalysis ?? "").trim() || "—",
    painPointTargeted: String(o.painPointTargeted ?? "").trim() || "—",
    offerClarity: String(o.offerClarity ?? "").trim() || "—",
    trustSignalsUsed: String(o.trustSignalsUsed ?? "").trim() || "—",
    ctaStrength: String(o.ctaStrength ?? "").trim() || "—",
    whatToSteal: Array.isArray(o.whatToSteal) ? o.whatToSteal.map((x) => String(x).trim()).filter(Boolean) : [],
    overallScore: Math.min(10, Math.max(1, overallScore)),
    overallExplanation: String(o.overallExplanation ?? "").trim() || "—",
  };
}

/** Ad critique result for Ad Score / Creative Critique feature. */
export type AdCritiqueResult = {
  overallScore: number;
  categories: {
    hookStrength: { score: number; explanation: string };
    clarity: { score: number; explanation: string };
    emotionalPull: { score: number; explanation: string };
    offerStrength: { score: number; explanation: string };
    ctaEffectiveness: { score: number; explanation: string };
    visualCopyAlignment?: { score: number; explanation: string };
  };
  whatToFix: string[];
};

const AD_CRITIQUE_SYSTEM_PROMPT = `You are an expert ad creative strategist. Critique the provided ad (image and/or copy) and grade it on the elements that drive performance.

Output valid JSON only, with these exact keys:
- "overallScore": number (1-10, can be decimal e.g. 7.4)
- "categories": object with keys: "hookStrength", "clarity", "emotionalPull", "offerStrength", "ctaEffectiveness", and if an image was provided also "visualCopyAlignment". Each value is an object: { "score": number 1-10, "explanation": string (2-3 sentences) }
- "whatToFix": array of 3-5 strings — prioritized, actionable improvements (specific instructions, not vague suggestions)

No markdown, no code fence. Only the JSON object.`;

export async function critiqueAdCreative(params: {
  type: "image" | "copy";
  imageBase64?: string;
  copy?: string;
  context?: string;
}): Promise<AdCritiqueResult> {
  const { type, imageBase64, copy, context } = params;
  if (type === "image" && !imageBase64?.trim()) throw new Error("imageBase64 required for image critique");
  if (type === "copy" && !copy?.trim()) throw new Error("copy required for copy critique");

  const userParts: string[] = [];
  if (context?.trim()) userParts.push(`Context: ${context.trim()}\n\n`);
  if (copy?.trim()) userParts.push(`Ad copy:\n${copy.trim()}`);
  if (type === "image" && !copy?.trim()) userParts.push("Analyze the ad image and any text visible in it.");
  const userText = userParts.join("\n") || "Critique this ad.";

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userText },
  ];
  if (type === "image" && imageBase64?.trim()) {
    const dataUrl = imageBase64.includes("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: AD_CRITIQUE_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi ad critique: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi ad critique: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi ad critique: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kimi ad critique: response is not valid JSON");
  }
  const o = parsed as Record<string, unknown>;
  const overallScore = typeof o.overallScore === "number" ? o.overallScore : Number(o.overallScore) || 7;
  const cats = (o.categories as Record<string, { score?: number; explanation?: string }>) ?? {};
  const cat = (key: string) => {
    const c = cats[key];
    return {
      score: typeof c?.score === "number" ? c.score : Number(c?.score) || 7,
      explanation: String(c?.explanation ?? "").trim() || "—",
    };
  };
  return {
    overallScore: Math.min(10, Math.max(1, overallScore)),
    categories: {
      hookStrength: cat("hookStrength"),
      clarity: cat("clarity"),
      emotionalPull: cat("emotionalPull"),
      offerStrength: cat("offerStrength"),
      ctaEffectiveness: cat("ctaEffectiveness"),
      ...(type === "image" ? { visualCopyAlignment: cat("visualCopyAlignment") } : {}),
    },
    whatToFix: Array.isArray(o.whatToFix) ? o.whatToFix.map((x) => String(x).trim()).filter(Boolean) : [],
  };
}

/** Single ad copy set for Ad Copy Generator. */
export type AdCopySet = {
  headline: string;
  primaryText: string;
  ctaSuggestion: string;
  toneLabel: string;
};

const AD_COPY_SYSTEM_PROMPT = `You are an expert ad copywriter. Generate 5 distinct ad copy variations. Each variation must have:
- "headline": string, under 40 characters, punchy and scroll-stopping.
- "primaryText": string, 2-4 sentences, benefit-focused.
- "ctaSuggestion": string, a single CTA phrase (e.g. "Shop now", "Get 20% off").
- "toneLabel": string, short label for the angle (e.g. "Emotional / Gift Angle", "Urgency / Limited Offer").

Vary the angles: emotional, urgency, social proof, problem-solution, bold claim, etc. Output valid JSON only: an array of exactly 5 objects with keys headline, primaryText, ctaSuggestion, toneLabel. No markdown, no code fence.`;

export async function generateAdCopyVariations(params: {
  productDescription: string;
  targetAudience: string;
  primaryGoal: string;
  tone: string;
  reviewContext?: string;
}): Promise<AdCopySet[]> {
  const { productDescription, targetAudience, primaryGoal, tone, reviewContext } = params;
  const userText = [
    `Product: ${productDescription.trim()}`,
    `Target audience: ${targetAudience.trim()}`,
    `Primary goal: ${primaryGoal.trim()}`,
    `Tone: ${tone.trim()}`,
    reviewContext?.trim() ? `\nReview insights (use this customer language):\n${reviewContext}` : "",
  ].filter(Boolean).join("\n\n");

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: AD_COPY_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi ad copy: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi ad copy: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi ad copy: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let arr: unknown;
  try {
    arr = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kimi ad copy: response is not valid JSON");
  }
  if (!Array.isArray(arr) || arr.length < 5) {
    throw new Error(`Kimi ad copy: expected 5 items, got ${Array.isArray(arr) ? arr.length : 0}`);
  }
  return arr.slice(0, 5).map((item, i) => {
    const o = item as Record<string, unknown>;
    return {
      headline: String(o.headline ?? "").trim().slice(0, 40) || `Headline ${i + 1}`,
      primaryText: String(o.primaryText ?? "").trim() || "—",
      ctaSuggestion: String(o.ctaSuggestion ?? "").trim() || "Learn more",
      toneLabel: String(o.toneLabel ?? "").trim() || "—",
    };
  });
}

/** UGC script entry for UGC Script Generator. */
export type UgcScriptEntry = {
  formatLabel: string;
  hookLine: string;
  fullScript: string;
  estimatedSeconds: number;
};

const UGC_SCRIPT_SYSTEM_PROMPT = `You are an expert UGC (user-generated content) scriptwriter. Write short-form video scripts that sound like a real person talking to camera — natural, conversational, not polished brand speak.

Output valid JSON only: an array of exactly 3 script objects. Each object has:
- "formatLabel": string (e.g. "Problem / Solution — 30 seconds")
- "hookLine": string — the opening sentence that stops the scroll
- "fullScript": string — full script in natural spoken language, with stage directions in brackets e.g. [hold product up to camera] or [show before/after]
- "estimatedSeconds": number — approximate spoken duration at natural pace

Vary the three scripts by format or angle. No markdown, no code fence.`;

export async function generateUgcScripts(params: {
  productDescription: string;
  targetAudience: string;
  scriptFormat: string;
  videoLength: number;
  tone: string;
  reviewContext?: string;
}): Promise<UgcScriptEntry[]> {
  const { productDescription, targetAudience, scriptFormat, videoLength, tone, reviewContext } = params;
  const userText = [
    `Product: ${productDescription.trim()}`,
    `Target audience: ${targetAudience.trim()}`,
    `Format: ${scriptFormat.trim()}`,
    `Target length: ${videoLength} seconds`,
    `Tone: ${tone.trim()}`,
    reviewContext?.trim() ? `\nReview insights (weave in customer language):\n${reviewContext}` : "",
  ].filter(Boolean).join("\n\n");

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: UGC_SCRIPT_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi UGC scripts: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi UGC scripts: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi UGC scripts: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let arr: unknown;
  try {
    arr = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kimi UGC scripts: response is not valid JSON");
  }
  if (!Array.isArray(arr) || arr.length < 3) {
    throw new Error(`Kimi UGC scripts: expected 3 items, got ${Array.isArray(arr) ? arr.length : 0}`);
  }
  return arr.slice(0, 3).map((item, i) => {
    const o = item as Record<string, unknown>;
    return {
      formatLabel: String(o.formatLabel ?? "").trim() || `Script ${i + 1}`,
      hookLine: String(o.hookLine ?? "").trim() || "—",
      fullScript: String(o.fullScript ?? "").trim() || "—",
      estimatedSeconds: typeof o.estimatedSeconds === "number" ? o.estimatedSeconds : Number(o.estimatedSeconds) || 30,
    };
  });
}

/** Amazon listing result for Listing Generator. */
export type AmazonListingResult = {
  title: string;
  titleCharCount: number;
  bullets: string[];
  description: string;
};

const LISTING_SYSTEM_PROMPT = `You are an expert Amazon listing copywriter. Generate a complete, conversion- and search-optimized Amazon listing.

Output valid JSON only with these exact keys:
- "title": string, keyword-optimized, under 200 characters. Include primary keyword near the front.
- "titleCharCount": number (character count of title).
- "bullets": array of exactly 5 strings. Each bullet starts with a capitalized benefit phrase in caps or title case followed by elaboration (e.g. "WATERPROOF & TARNISH-RESISTANT — Wear it to the beach, gym, or shower without worry").
- "description": string, 150-250 words, conversational, benefit-led, closing with a soft CTA. Can include line breaks for readability.

No markdown, no code fence. Only the JSON object.`;

export async function generateAmazonListing(params: {
  productName: string;
  whatItIs: string;
  keyFeatures: string[];
  primaryKeyword: string;
  targetBuyer: string;
  reviewContext?: string;
  competitorContext?: string;
}): Promise<AmazonListingResult> {
  const { productName, whatItIs, keyFeatures, primaryKeyword, targetBuyer, reviewContext, competitorContext } = params;
  const userText = [
    `Product name: ${productName.trim()}`,
    `What it is and what it does: ${whatItIs.trim()}`,
    `Key features: ${keyFeatures.slice(0, 5).join("; ") || "None"}`,
    `Primary keyword (for search): ${primaryKeyword.trim()}`,
    `Target buyer: ${targetBuyer.trim()}`,
    reviewContext?.trim() ? `\nReview insights (use customer language):\n${reviewContext}` : "",
    competitorContext?.trim() ? `\nCompetitor listing to outposition (address gaps and weaknesses):\n${competitorContext}` : "",
  ].filter(Boolean).join("\n\n");

  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: LISTING_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      max_completion_tokens: 2048,
      thinking: { type: "disabled" as const },
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) throw new Error(`Kimi listing: ${res.status} ${rawBody}`);

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error("Kimi listing: invalid JSON response");
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Kimi listing: no content");

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1]!.trim() : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Kimi listing: response is not valid JSON");
  }
  const o = parsed as Record<string, unknown>;
  const title = String(o.title ?? "").trim().slice(0, 200) || "Product title";
  const bullets = Array.isArray(o.bullets) ? o.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 5) : [];
  while (bullets.length < 5) bullets.push(`Benefit ${bullets.length + 1} — Key selling point.`);
  return {
    title,
    titleCharCount: title.length,
    bullets,
    description: String(o.description ?? "").trim() || "Product description.",
  };
}
