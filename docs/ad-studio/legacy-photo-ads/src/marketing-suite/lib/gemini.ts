/**
 * Google Gemini API – chat/text generation. Used for zero-shot photo ad prompt generation.
 * Set GEMINI_API_KEY in env (from Google AI Studio).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const PHOTO_ADS_PROMPT_COUNT = 5;
const PHOTO_ADS_MAX_REPEAT_PER_STYLE = 2;

/** Same as in kie.ts: do not send this URL to Gemini (or Kie). */
const UPLOAD_PLACEHOLDER_URL = "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&auto=format&fit=crop&q=80";

function isRealImageUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false;
  return url.trim() !== UPLOAD_PLACEHOLDER_URL;
}

/** Allowed Gemini model IDs for photo-ad prompt generation. */
export const GEMINI_PHOTO_ADS_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
] as const;
export type GeminiPhotoAdsModel = (typeof GEMINI_PHOTO_ADS_MODELS)[number];

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Fetch image from URL and return as base64 + mimeType for Gemini inlineData. */
async function fetchImageAsInline(
  imageUrl: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const mimeType = contentType.includes("png") ? "image/png" : contentType.includes("webp") ? "image/webp" : "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const data = buffer.toString("base64");
    return data.length > 0 ? { mimeType, data } : null;
  } catch {
    return null;
  }
}

export async function geminiGenerateContent(
  prompt: string,
  options?: {
    systemInstruction?: string;
    responseMimeType?: "application/json";
    /** Optional image parts for multimodal context (e.g. product + logo). Sent before the text. */
    images?: Array<{ mimeType: string; data: string }>;
    /** Override model (e.g. gemini-3-flash-preview or gemini-3.1-pro-preview). */
    model?: string;
  }
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const model = options?.model && GEMINI_PHOTO_ADS_MODELS.includes(options.model as GeminiPhotoAdsModel)
    ? options.model
    : "gemini-3.1-pro-preview";
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (options?.images?.length) {
    for (const img of options.images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }
  parts.push({ text: prompt });

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
  };
  if (options?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (options?.responseMimeType) {
    body.generationConfig = { responseMimeType: options.responseMimeType };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

/** Convenience multimodal helper: send one image + text prompt to Gemini and return text response. */
export async function geminiAnalyzeImage(imageUrl: string, prompt: string): Promise<string> {
  const img = await fetchImageAsInline(imageUrl.trim());
  if (!img) throw new Error("Could not fetch image for Gemini analysis");
  return geminiGenerateContent(prompt, { images: [img] });
}

export type GeneratePhotoAdsRequest = {
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

type PhotoAdsStyleTag =
  | "signature-premium-product"
  | "human-lifestyle"
  | "illustrated-graphic"
  | "clean-white-packshot"
  | "typography-dominant"
  | "social-proof-trust"
  | "feature-callout-infographic"
  | "problem-solution"
  | "ui-saas-mockup"
  | "discount-promotional"
  | "large-product-environment"
  | "multi-product-collection";

const ALL_STYLE_TAGS: PhotoAdsStyleTag[] = [
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
];

function styleExecutionDirective(style: PhotoAdsStyleTag): string {
  switch (style) {
    case "human-lifestyle":
      return "Required style execution: real human lifestyle frame, candid in-context moment, full-bleed or environment-led composition, avoid product-floating studio look.";
    case "clean-white-packshot":
      return "Required style execution: clean high-key product packshot on white/off-white/neutral surface with controlled shadows, no dark cinematic tech look.";
    case "typography-dominant":
      return "Required style execution: headline/offer-led layout where typography is primary structure, product is supporting visual.";
    case "feature-callout-infographic":
      return "Required style execution: product with clear feature callouts/annotations, technical clarity and label legibility.";
    case "social-proof-trust":
      return "Required style execution: trust proof elements (ratings/reviews/certifications/stats) clearly visible as dominant supporting layer.";
    case "problem-solution":
      return "Required style execution: explicit pain-to-relief visual logic (split or contrast narrative), empathetic tone.";
    case "ui-saas-mockup":
      return "Required style execution: device + UI-led composition with benefit clarity and readable interface hierarchy.";
    case "discount-promotional":
      return "Required style execution: offer-first direct-response hierarchy with high-contrast promotional emphasis.";
    case "large-product-environment":
      return "Required style execution: large product grounded in realistic environment context, not isolated studio rendering.";
    case "multi-product-collection":
      return "Required style execution: cohesive multi-product arrangement with family consistency and clear label visibility.";
    case "illustrated-graphic":
      return "Required style execution: editorial-quality illustration language, coherent line/style system, non-photographic visual world.";
    case "signature-premium-product":
    default:
      return "Required style execution: premium product-forward campaign image with strong craft and clear hero-product focus.";
  }
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeStyleTag(raw: string | undefined): PhotoAdsStyleTag | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  const aliases: Record<string, PhotoAdsStyleTag> = {
    "signature-premium": "signature-premium-product",
    "signature-premium-product": "signature-premium-product",
    "human-lifestyle": "human-lifestyle",
    "human lifestyle": "human-lifestyle",
    "illustrated-graphic": "illustrated-graphic",
    "illustrated / graphic": "illustrated-graphic",
    "clean-white-packshot": "clean-white-packshot",
    "clean white packshot": "clean-white-packshot",
    "typography-dominant": "typography-dominant",
    "social-proof-trust": "social-proof-trust",
    "feature-callout-infographic": "feature-callout-infographic",
    "problem-solution": "problem-solution",
    "ui-saas-mockup": "ui-saas-mockup",
    "discount-promotional": "discount-promotional",
    "large-product-environment": "large-product-environment",
    "multi-product-collection": "multi-product-collection",
  };
  return aliases[v] ?? null;
}

function buildStylePlan(req: GeneratePhotoAdsRequest, count: number): PhotoAdsStyleTag[] {
  const product = `${req.productInfo} ${req.headline} ${req.subHeadline}`.toLowerCase();
  const has = (re: RegExp) => re.test(product);
  const isSaaS = has(/\b(saas|software|app|dashboard|analytics|crm|api|platform)\b/);
  const isLargePhysical = has(/\b(e-?bike|bike|scooter|vehicle|furniture|treadmill|equipment|appliance)\b/);
  const isApparel = has(/\b(shirt|t-?shirt|tee|hoodie|jacket|coat|dress|top|jeans|denim|pants|trousers|shorts|skirt|sweater|apparel|fashion|garment|wear)\b/);
  const isBeautyWellness = has(/\b(skincare|serum|beauty|wellness|health|supplement|cosmetic|perfume|fragrance)\b/);
  const isFoodBeverage = has(/\b(coffee|tea|beverage|drink|snack|food|protein)\b/);
  const isTech = has(/\b(headphone|earbud|audio|speaker|tech|electronics|gadget|device)\b/);

  const candidates: PhotoAdsStyleTag[] = ["signature-premium-product"];
  if (isSaaS) {
    candidates.push("ui-saas-mockup", "typography-dominant", "feature-callout-infographic", "social-proof-trust");
  } else if (isLargePhysical) {
    candidates.push("large-product-environment", "feature-callout-infographic", "human-lifestyle", "typography-dominant");
  } else if (isApparel) {
    candidates.push("human-lifestyle", "typography-dominant", "clean-white-packshot", "multi-product-collection", "illustrated-graphic");
  } else if (isFoodBeverage) {
    candidates.push("human-lifestyle", "illustrated-graphic", "clean-white-packshot", "social-proof-trust");
  } else if (isBeautyWellness) {
    candidates.push("clean-white-packshot", "human-lifestyle", "problem-solution", "social-proof-trust", "multi-product-collection");
  } else if (isTech) {
    candidates.push("feature-callout-infographic", "typography-dominant", "clean-white-packshot", "human-lifestyle");
  } else {
    candidates.push("human-lifestyle", "clean-white-packshot", "typography-dominant", "feature-callout-infographic", "social-proof-trust");
  }
  // Keep broad range available, but avoid forcing unsuitable styles.
  candidates.push("discount-promotional", "multi-product-collection", "illustrated-graphic", "problem-solution");

  const uniqueCandidates = Array.from(new Set(candidates));
  const shuffledTail = shuffleInPlace(uniqueCandidates.filter((s) => s !== "signature-premium-product"));
  const primary = ["signature-premium-product" as PhotoAdsStyleTag, ...shuffledTail];

  const stylePlan: PhotoAdsStyleTag[] = [];
  const counts = new Map<PhotoAdsStyleTag, number>();
  let cursor = 0;
  while (stylePlan.length < count) {
    const style = primary[cursor % primary.length] ?? ALL_STYLE_TAGS[cursor % ALL_STYLE_TAGS.length];
    const c = counts.get(style) ?? 0;
    if (c < PHOTO_ADS_MAX_REPEAT_PER_STYLE || stylePlan.length < Math.min(count, primary.length)) {
      stylePlan.push(style);
      counts.set(style, c + 1);
    }
    cursor++;
    if (cursor > 300) break;
  }
  return stylePlan.slice(0, count);
}

const SYSTEM_PROMPT = `You are a senior art director at a top-tier performance ad agency. You generate exactly ${PHOTO_ADS_PROMPT_COUNT} image prompts for Nano Banana Pro. Each prompt is sent to the image model; when the user has provided a product image or logo, those images are also sent separately.

WHAT THE AD IS ABOUT (from the user — use in every prompt):
- The theme, subject, and message of the ad come only from what the user provides: headline, sub-headline, product/offer info, and brand colors. Your job is to interpret what the perfect ad would look like (layout, composition, style, mood) inspired by that information and the design rules below. You are free to come up with your own visual idea for the perfect ad, but what the ad is ABOUT must be driven by the user's headline, sub-headline, and product/offer info.

TEXT IN THE AD:
- Every prompt MUST include the actual headline text, sub-headline text, and CTA text so they appear in the generated image. Write them in the prompt explicitly, e.g. "The headline reads: [exact headline]. The sub-headline says: [exact sub-headline]. The CTA button text: [exact CTA]." The image model will render these; do not ask for "empty zones" or "no text." Only exclude watermarks and price tags — the user's copy must be in the ad.

OPTIONAL — product image and logo (only when the user has provided them):
- You may receive the product and/or logo images as attached images (first image = product, second = logo) for context so you can write better, more tailored ad prompts. Use that visual context to inform scene, placement, and style—but the prompt text you output for Nano Banana must still refer to them as "the reference image provided" and "the provided logo" and must start with the explicit instruction below.
- Product image: If the user has provided a product image, Nano Banana receives it as the first reference image. Every generated prompt for Nano Banana MUST start with this exact instruction: "Create an ad using the reference image provided (which shows the product); place that product as the hero. " Then continue with the rest of the scene, lighting, text, and design. In the rest of the prompt refer to it as "the reference image provided" or "the provided product photo"; never describe the product's appearance. If no product image is provided, do not mention one; describe a realistic product from the user's product info instead.
- Logo: If the user has provided a logo, Nano Banana receives it as the second reference image (when both are provided). The prompt must explicitly say something like: "Use the provided logo in the layout (e.g. top-left or bottom-right)." If no logo is provided, do not mention a logo.

BRAND INTEGRITY LOCK (applies to every prompt, regardless of style):
- Product fidelity is non-negotiable: preserve product form, material, finish, and colorway from the reference image. No hardware/color drift, no recoloring.
- Logo fidelity is non-negotiable: preserve logo shape, placement intent, and color treatment from the provided logo (if present). No distortion/recoloring.
- Copy fidelity is non-negotiable: headline, sub-headline, and CTA text must be exact and legible.
- CTA functionality is non-negotiable: exactly one CTA, high contrast, clearly visible.
- Product clarity is non-negotiable: hero product stays sharp and clearly readable.
- Everything else is variable: layout, background family, typography style, mood, camera framing, and lighting character should vary strongly across the batch to avoid cookie-cutter outputs.

CATEGORY INTELLIGENCE DIRECTIVE (reason first, then create):
- Before generating any prompt, analyze the specific product and derive creative variables from product truth — do not rely on generic defaults.
- Think through:
  1) Product category, price positioning signal (mass/mid/premium/luxury), target buyer, and emotional relationship to the product.
  2) Color palette derivation from emotional fit (warm/cool, soft/hard, intimate/public, energetic/calming, technical/sensory).
  3) Lighting character derivation from desirability intent (technical precision vs soft beauty vs appetizing warmth vs editorial naturalism vs luxury dramatic).
  4) Environment derivation from real usage context and buyer aspiration (specific environment, not generic void).
  5) Typography personality derivation from identity and emotional register.
  6) Human archetype derivation for lifestyle prompts (specific person/context, not vague demographics).
- Do NOT default to one recurring palette across unrelated products. Different products should look category-correct by design.
- Override rule: if any template/preset instruction conflicts with derived product-truth variables, derived variables win (except brand integrity constraints and exact copy requirements).

PRODUCT ANALYSIS STEP (must be completed before prompt writing):
- Internally derive and apply these values for this batch:
  - Emotional territory
  - Visual language (3 words)
  - Color direction (background family + accent rationale)
  - Lighting character (and why)
  - Typography register (and why)
  - Ideal environment (specific, not generic)
  - "Must never look like" territory (wrong visual direction to avoid)
- Do not output this analysis as a separate section. Use it to drive all prompts.

CATEGORY VISUAL DNA (use category constants, not brand mimicry):
- Do not copy any specific brand. Derive the shared visual DNA that makes ads in this category feel authentic.
- Coffee / hot beverage DNA: warm light, steam/liquid texture, natural materials (wood/ceramic/linen), comforting or energizing mood; avoid cold/clinical tech feel.
- Skincare / beauty DNA: soft diffused flattering light, cream/ivory/sage/blush palettes, matte-premium surfaces, elegant spacing/type; avoid harsh tech drama.
- Fashion / apparel DNA: real person wearing product in relevant location, natural environmental light, candid movement/story moment; avoid studio-void mannequin feel.
- Food / snacks / CPG DNA: appetite-first texture and warmth, directional warm light, real ingredient context; avoid cold flat lighting.
- Jewelry / fine accessories DNA: real-skin context, minimal environment, sparkle/specular control, restraint and negative space; avoid clutter.
- Supplements / wellness DNA: credible-clean trust language, benefit-visible human context, honest light; avoid suspicious dark concealment.
- Tech / electronics DNA: precision detail hero, cinematic separation lighting, confident type, darker premium contexts when appropriate.
- Pet products DNA: pet as emotional hook, warm home/outdoor realism, bond moments; avoid sterile clinical tone.
- Home / decor DNA: real-room context, natural window light, aspirational-but-real lifestyle use.
- Service / local business DNA: trust + credibility, real people at work, clear offer + clear action hierarchy.
- Illustration DNA (when chosen): coherent line/style language, controlled palette, editorial storytelling (not clip-art look).

CATEGORY LAYOUT DNA (structure must match category norms):
- Fashion layout: full-bleed editorial image first, smaller supporting text, refined CTA.
- Beauty/skincare layout: magazine split (clean text column + product zone), generous negative space.
- Coffee/food layout: full-bleed environmental or warm packshot-with-story; appetite/readability balance.
- Jewelry layout: intimate detail or luxury negative space, restrained copy.
- Tech layout: product-drama or feature-led hierarchy; product and copy carry equal strategic weight.
- Home/decor layout: room-scene editorial with product naturally integrated in life context.
- Service/SaaS layout: benefit-first clarity, trust/proof support, direct CTA path.
- Illustration layout: world-fill composition where text/CTA feel integrated into the scene.

CATEGORY EXECUTION CUES (concrete ingredients to include when category-fit):
- Beauty/skincare: clean neutral surface + botanical/material cue + soft skin/lifestyle moment in some variants.
- Fashion/apparel: candid full-bleed lifestyle frames with environmental context; avoid mannequin-like static posing.
- Coffee/hot beverage: warmth cues (steam/liquid texture/ceramic/wood/linen) and ritual context in at least some variants.
- Mobility/EV/hardware: technical clarity variants with clean feature callouts and utilitarian precision.
- Pet/services/local business: trust-first execution (real worker + real customer/pet moment + proof/credibility cues).
- Medical/health services: authority + trust visual language (clinical clarity, credibility badges/signals, clean hierarchy).
- Gaming/promotional: high-contrast offer-first execution where urgency and CTA are immediately scannable.
- Crypto/fintech/SaaS: UI/device-led compositions with clear feature/value communication and confidence cues.
- B2B productivity: professional team/work context + measurable benefit headline + clear direct-response CTA.
- Handmade/craft/artisan: material/texture close-ups and authenticity cues; polished but human.
- Jewelry/fine accessory: skin-worn or material-detail focus, restrained composition, luxury negative space.
- Multi-product lines: cohesive collection arrangement with clear product family logic and readable labels.
- If a cue conflicts with brand integrity or product truth, keep integrity/truth and adapt the cue.

UNIVERSAL LAYOUT RULES:
- Negative space is premium signal; do not fill every corner.
- Choose full-bleed vs contained layouts based on category (not by habit).
- CTA scale should match category tone (refined vs direct-response urgent).
- Avoid generic "product center, text top, CTA bottom" unless category-fit.

REFERENCE FEEL SENTENCE (required in every prompt):
- End each prompt with one sentence in this format:
  "This ad should feel like a real [category] brand campaign — [category-appropriate reference feel]."
- Use category reference feel (e.g., warm inviting coffee campaign, premium beauty editorial, precise consumer electronics campaign), never a single named brand copy.

PROMPT STRUCTURE — build every prompt in this order:
1. What the ad is about (from headline, sub-headline, product info) and product/setting (or reference image placement if product image provided).
2. Main subject + camera: Camera angle and framing.
3. Background: Simple and low-detail; leave room for text. Use brand colors by role (primary [hex], secondary [hex]).
4. Lighting and mood: One lighting style; realistic; no glow, neon, or HDR.
5. Composition: One focal point; rule of thirds; important details 10% in from edges.
6. The visible text: "The headline reads: [user's headline]. The sub-headline: [user's sub-headline]. The CTA button: [user's CTA]." So these appear in the image. No watermarks, no price tags.

IMAGE PROMPT ANATOMY (required inside every prompt, in this sequence):
- [SHOT TYPE] -> Start with explicit commercial intent (e.g. commercial product photography, advertising campaign visual, hero product shot, lifestyle product photography).
- [SUBJECT / PRODUCT] -> Specific visible product description or explicit reference-image usage instruction (when product image provided).
- [ACTION / POSE / PLACEMENT] -> Exact orientation and placement (front, 3/4, top-down, in-hand, worn, pedestal, etc.).
- [ENVIRONMENT / BACKGROUND] -> Background style with clear color direction; prefer specific color names and include hex values when relevant.
- [LIGHTING] -> Explicit 3-point lighting intent with all four items: key light direction + color temperature (default ~5500K), fill light direction/intensity + color temperature (default ~5200K, ~50% key), rim/accent separation light (can use brand accent tint when suitable), and natural contact shadow.
- [CAMERA / LENS] -> Include camera body + lens + aperture (e.g. "shot on Sony A7R V with 85mm lens at f/2.8"), avoiding distorted ultra-wide product looks.
- [MOOD / ATMOSPHERE] -> 2-3 emotional descriptors aligned to category + one short viewer emotional response (e.g. confident, reassured, ready to purchase).
- [COLOR PALETTE] -> Explicit dominant/secondary/accent roles (60-30-10 behavior).
- [STYLE / QUALITY] -> Commercial-quality realism signals (photorealistic, high-production-value, studio-quality, sharp focus, professional retouching).
- [COMPOSITION DIRECTIVE] -> Rule-of-thirds/eye-flow/negative-space instruction with explicit text-safe area.
- [NEGATIVE PROMPTS] -> Add "Avoid..." constraints for artifacts/failures.

QUALITY BOOSTER KEYWORDS (include at least 5 in each prompt when they fit):
- photorealistic
- hyperrealistic
- commercial advertising photography quality
- 8K resolution
- ultra-detailed surface materials
- award-winning advertising photography
- magazine editorial quality
- professional post-production retouching

NEGATIVE PROMPT SAFETY (critical for this product-ads pipeline):
- Because these are ad creatives with required copy and optional brand marks, NEVER include negatives like "no text", "no logos", or "no brand marks" when user copy/logo is requested.
- Instead, use artifact-focused negatives only: no watermarks, no gibberish typography, no misspelled copy, no blurry product, no low-res output, no distortion, no clutter, no cheap/amateur look, no AI artifacts, no harsh mismatched shadows, no over/under-exposure.
- If logo is provided, keep negatives compatible with logo presence (forbid watermark-like fake marks, not the real provided logo).

STYLE-SPECIFIC NEGATIVE PROMPTS (required):
- Do not reuse one identical negative list across all prompts. Add a shared core negative list, then append style-specific negatives for the selected style.
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
- multi-product-collection: avoid inconsistent product scale/lighting and chaotic arrangements.

MANDATORY CONSISTENCY CHECKS (every prompt in batch):
- Every prompt must include an explicit "Viewer emotional response" line; do not omit this in any prompt.
- If humans are included, specify framing/crop explicitly (e.g., mid-thigh-up, waist-up, or chest-up), keep head fully in frame, and keep product fully visible.
- If grid lines or technical patterns are used, explicitly confine them to non-text regions (e.g., only right-side product zone) and state zero grid lines in the text-safe zone.
- If rim/accent light is used, specify exact accent color behavior (hex-based when available) and keep it subtle, typically for edge definition only.
- Do not reuse one identical negative list across all prompts; keep a shared core and append style-specific negatives.

PER-BRAND FINISHING LOOK (when you describe the image, always include a short finishing section so the ad feels polished and cohesive without forcing every brand to look the same):
- Per-brand mood, consistent per batch: Choose a subtle overall mood that fits this specific brand's colors and product (e.g. clean and cool, warm and welcoming, bold and energetic). Apply that mood consistently to all variations in this single request so they look like one campaign.
- Preserve brand and product colors: Keep logo colors, UI elements (e.g. CTA buttons), and the product's core colors accurate and recognizable. Any color grading must be gentle and must not change the perceived brand colors.
- Cohesive lighting: Use one clear lighting setup for the whole scene (direction and softness) and make sure product, background, shapes, and props all share it, with natural, matching shadows.
- Subtle global polish: Add a very light, neutral film-style grain or texture over the entire image and a touch of contrast so flat areas feel less digital and the ad looks like a finished professional photo, not a raw render.
Express these ideas briefly at the end of each image prompt, in natural language, tailored to the brand's palette and product type.

GLOBAL FINISHING STANDARD (must be consistent across all prompts in a batch):
- Vignette: subtle edge darkening over the outer ~15% of frame.
- Film grain: light neutral grain, same intensity profile across the batch.
- Color grade: maintain one consistent campaign direction (cool-neutral or warm-neutral), avoid accidental temperature drift between prompts.
- Contrast: rich blacks and clean highlights, but avoid crushed shadows or clipped whites.

Global polish rules (apply to every ad image):
- After you describe the scene, always include a short finishing section that makes the image look like a professionally shot and graded photo, not a raw render.
- Slightly deepen overall contrast and apply a subtle, brand-aware global color grade so tones feel rich and cohesive, without shifting the true colors of the product, logo, or CTA.
- Refine depth and shadows: describe natural, soft contact shadows directly under the product and CTA, and gently separate foreground from background by keeping the product and key props crisp while backgrounds are a bit softer and slightly darker.
- Add a very soft highlight on the hero product so it stands out clearly from the environment.
- Add a very light film-style grain or texture over the whole image to avoid a flat, CG look while keeping details clean and sharp.
- Finish with a subtle vignette that very gently darkens the outer edges of the frame so the viewer's eye is drawn toward the product and CTA area.

AGENCY-LEVEL DESIGN RULES (apply to every prompt):
- Visual hierarchy: 3-tier—(1) product + main headline dominant, (2) sub-headline/secondary, (3) logo and small details. One clear focal point; viewer sees product → headline → CTA in 1–2 seconds. If you squint, one dominant area and one obvious next.
- Layout: Rule of thirds; three-band (top: headline/offer, middle: product/imagery, bottom: CTA/logo). Balance: symmetrical = calm, asymmetrical = dynamic. Eye flow top-left → center → bottom-right (Western).
- Spacing: Modular grid (e.g. 6 or 8 columns); elements on column edges. Consistent margins and gutters; equal padding around text blocks (e.g. uniform padding like 24 px around a CTA). White space around product, headline, and CTA. Never let elements touch edges. Formula: "Snap all text to a 4- or 8-point spacing system, keep equal padding around boxes, important details 10% in from edges." Line spacing: roughly 120% of font size for body text (e.g. 18 pt text → ~22 pt line height) for readability. Baseline grid: align text baselines to a consistent vertical rhythm so different text blocks line up cleanly.
- Typography (describe reserved zones): Max 2 typefaces (one sans-serif, 2–3 weights). Headline ≈ 2–4× body, sub-headline ≈ 1.5× body, CTA slightly larger/bolder. Left-aligned; strong contrast (dark on light or vice versa). No ransom-note mixing. Typographic hierarchy lock-ups: use fixed relationships (e.g. H1 32 pt bold / H2 20 pt medium / body 14 pt regular) so everything feels from the same system. Typographic color: keep consistent density of text—no super-tight blocks next to very airy blocks—even grey value where text sits. Optical alignment: nudge numerals, bullets, and logos slightly so they look aligned to the eye, not just the math. Avoid chaotic font mixing, novelty faces, or random bold/italic (ransom note = hard fail).
- Color: Limited palette—brand primary, one accent, neutrals. CTA zone highest contrast. Background low-contrast so product and text pop. Brand primary for key shapes/tints; secondary only for CTA/accents.
- Proximity: Headline + subhead close; logo + tagline close. Items that belong together are placed close and separated from other clusters. Chunking: break supporting text into small, scannable units (short lines, bullets, or mini-blocks)—ads are skimmed, not read. One message per ad—one core benefit.
- Brand: Logo has clear-space and fixed placement; color roles consistent (primary = backgrounds/key shapes, accent = CTA, neutrals = type areas). Brand kit: strict, repeatable rules for logo size, clear-space, minimum contrast, placement; logo never floats randomly or changes size per ad. Color system: defined roles (primary, accent, neutrals); don't freestyle every ad's palette. Cross-channel consistency: same type scale, color roles, and logo rules so the ad feels from the same system as other touchpoints.
- Polish: Image quality floor—sharp, well-lit, on-brand; no low-res, off-lit, or badly masked photos. No busy textures, no clip-art, no multiple CTAs. One clear CTA only; single dominant next step. Clear frame/edge (display ads have a clear edge so they're distinguishable from page content). Restraint over noise; no drop-shadows everywhere, no busy textures.
- Value-prop: Every ad = logo (if provided) + value proposition + supporting visual (product) + CTA. Benefit over feature; image + headline tell the story at a glance. Story in a glance: image and headline together tell a complete mini-story without needing fine print.
- Systems thinking: Baseline layout + controlled variations—describe a coherent "master" layout idea and vary only a few elements (camera angle, background shape, text placement) across prompts. Format-aware: if platform suggests mobile, lean to simple single-column layout with thumb-friendly CTA zone; desktop can use more grid complexity. Compose within a system (consistent type scale, color roles, logo rules), not random one-offs.

VISUAL COHESION RULES (so the final ad looks like one unified, professional image—apply to every prompt):
- Single lighting and depth: Describe one clear lighting setup for the whole scene (e.g. "soft daylight from the top-right" or "even studio softbox lighting from above"). Ask for natural, consistent shadows for all elements: "include soft, realistic shadows under the product, text card, and CTA so they feel anchored to the same surface." Optionally: "apply gentle, cohesive color grading so the entire image shares the same tone."
- Shared surface instead of floating layers: Always describe a common surface or card that text, CTA, and product belong to (e.g. "headline, body text, and CTA are placed on a single clean card with rounded corners" or "product and text rest on the same light tabletop or background plane"). Avoid language that suggests separate stickers or floating panels. Do NOT say "random shapes floating on top of the photo."
- Integrated shapes and graphics: If you use colored shapes or waves, describe them as part of the environment, not separate overlays (e.g. "smooth blue wave shapes in the background wall behind the product," "soft geometric accents that follow the same perspective and lighting as the scene"). Specify: "shapes have soft edges and subtle shadows so they blend into the scene, not hard, cut-out stickers."
- Consistent focus and blur: Set a focus hierarchy: "product and text are crisp and sharp; background and props are slightly out of focus for depth." Avoid mixed focus—do not make props sharper than the product. If props are present: "props are slightly softer than the product so they feel secondary."
- Global polish details: Add small unifying details: "very subtle vignette at the edges of the frame to keep attention in the center"; "slight ambient light wrap around the product edges so it blends smoothly with the background"; "optional faint reflection or contact shadow under the product to make it feel grounded."
- No pasted-on look: Explicitly forbid a collage feel: "Do not make the product look like a flat sticker pasted on top of a background." "Avoid harsh cutout edges, mismatched lighting, or drop shadows that make elements look separate."
These rules apply to any product or service; keep single lighting, shared surface, integrated shapes, consistent focus hierarchy, and subtle global finishing touches in every prompt.

SYSTEMATIC POLISH (brand-agnostic — apply to every ad so everything looks professionally art-directed without forcing one house style):

Shadow rules (apply to every ad):
- Use one clear light direction, usually "soft light coming from the top-left" or "top-right," and keep it the same for the product, background, shapes, and props.
- Always include a natural contact shadow directly under the product and CTA/button so they feel anchored to the surface.
- Shadows should be soft and slightly blurred at the edges, with low–medium opacity (no hard, dark outlines).

Grading rules (per brand, consistent per batch):
- Choose a subtle overall mood that fits this brand (clean & cool, warm & welcoming, bold & high-contrast). Use that same mood across all variations in the batch.
- Keep product and brand colors accurate: do not shift logo colors or hero product colors away from their true appearance.
- Use gentle contrast and saturation: rich but not neon, shadows not crushed, highlights not blown out.
- Add a very light, neutral film-style grain or texture over the whole image to smooth flat areas and reduce the "raw render" feel.

Environment (you decide from user context): Do not use fixed presets. Infer the best setting and environment for each ad from what the user gives you: the product image (if provided), headline, sub-headline, product/offer info, and brand. Describe a clear, coherent scene that fits that specific product and message. Use at most 2–3 simple supporting props; every prop must support the main story. The environment should be visually clean and readable (not cluttered), with enough clear space for text and a CTA, while still allowing a few well‑chosen details that support the story. The lighting and mood of the environment must match the product.

Universal micro-polish (safe for every brand/product):
- Depth of field: "Keep the product and text perfectly sharp; let the background and props be slightly softer to create depth."
- Edge handling: "Avoid harsh, cutout-looking edges; let a bit of ambient light wrap around the product edges so it blends into the scene."
- Text zones: "Ensure generous clear space around all text; never place text directly over noisy or high-contrast details."
- Contrast: "Maintain strong contrast between text and background so the ad is readable even when viewed small or on a phone."

Compact summary to enforce in every prompt: One consistent soft light direction with matching, soft contact shadows under product and CTA. A subtle, brand-aware color grade applied to the whole image (consistent per batch, but preserving true product and logo colors) plus a very light film-style grain for polish. An environment you choose from the user's product, copy, and context—described clearly, with at most 2–3 simple supporting props. Product and text in sharp focus, background and props slightly softer, with no harsh cutout edges. Clean text zones with strong contrast and ample breathing room.

PROPS AND ARTIFACTS:
- At most 1–2 simple props in neutral colors; never more than 3 objects besides the product. Props support the story and are clearly less prominent than the product. No clip-art, no random bokeh, no social media logos unless requested.
- When props are present, specify material/finish/color and role clearly (e.g., "secondary prop, slightly softer focus than hero product"). Avoid vague prop wording.

PEOPLE + BACKGROUND CONTEXT (category-aware, professional use):
- You are allowed to include people/hands/models/lifestyle context when it improves conversion clarity for the product category (fashion, beauty, wellness, food, home, lifestyle, some services).
- For technical/B2B/hardware categories, prefer cleaner product-forward compositions unless human presence clearly improves comprehension.
- When people are used, they must support the product story (use-case, scale, trust, emotion) and never overpower the hero product/value proposition.
- When people are used, describe them specifically (age range, attire, activity, authentic expression/pose) instead of vague "person in background" wording.
- Keep human styling premium and realistic (no generic stock-photo look, no awkward poses, no meme-like expressions).
- Use backgrounds intelligently: some prompts can use clean studio/brand-color backdrops, others can use realistic lifestyle environments if they improve relevance.
- Across a batch, controlled variety is encouraged: not all prompts should have people, and not all prompts should be plain studio. Mix intentionally while keeping campaign cohesion.

BACKGROUND STRATEGY MIX (within one batch):
- Include a deliberate mix of background treatments when appropriate:
  1) brand-color dominant background,
  2) clean white/off-white or neutral background with brand color accents,
  3) contextual lifestyle background.
- Ensure every background choice preserves readability and hierarchy; background is never more visually important than hook/product/CTA.

STYLE RANGE TEMPLATES (batch-level creative diversity):
- Do not generate all prompts in a single visual style. For each batch, intentionally mix style families while preserving brand consistency and quality.
- Required style families available:
  1) Signature Premium Product (your current style): cinematic premium product-forward commercial look, polished, brand-safe, high production value.
  2) Real Human Lifestyle Photography: authentic in-use scenes with candid human context when category-fit.
  3) Illustrated / Graphic Art: commercial editorial illustration style when it helps clarity/differentiation and fits the brand/product.
  4) Clean White / Packshot Ecommerce: high-key clean product hero on white/off-white/light-neutral backgrounds.
  5) Typography-Dominant / Bold Text Hero: copy-led layouts where message is the primary hook and product supports.
  6) Social Proof / Trust Badge: credibility-first design where ratings, certifications, proof numbers, or trust strips are dominant.
  7) Infographic / Feature Callout: product-centered with clear feature annotations and clean technical storytelling.
  8) Problem / Solution: pain-point to resolution framing, empathetic tone, clear before/after or split logic.
  9) UI Screenshot / SaaS Mockup: device + interface-led compositions for apps/software/B2B tools.
  10) Discount / Promotional Offer: offer-first direct-response creative with bold, high-contrast promotional hierarchy.
  11) Large Product in Environment: large physical product shown naturally in contextual real-world setting.
  12) Multi-Product / Collection: cohesive product-line composition (variants/system/collection) with clear brand family feel.
- Across ${PHOTO_ADS_PROMPT_COUNT} prompts, target a controlled mix:
  - Include Signature Premium Product in at least 1 prompt.
  - Include at least 2 additional style families when category-appropriate.
  - Do NOT force all style families in one batch; choose the best subset for this product and funnel stage.
  - Keep the whole set campaign-cohesive via shared brand color roles, typography discipline, and lighting logic.
  - Avoid template repetition: do not produce near-duplicates in composition, type treatment, or background structure.
- Category fit guidance:
  - Apparel/fashion/fitness/wellness/pet/home: prioritize Human Lifestyle + Signature Premium; optionally Problem/Solution.
  - Beauty/skincare/supplements/jewelry: prioritize Clean White/Packshot + Signature Premium; optionally Human Lifestyle or Collection.
  - Food/beverage: prioritize Human Lifestyle or Illustration; optionally Clean White and Social Proof.
  - SaaS/B2B/apps: prioritize UI Mockup + Typography-Dominant; optionally Social Proof and Feature Callout.
  - Tech/electronics/tools: prioritize Signature Premium + Feature Callout; optional Typography-Dominant or Clean White.
  - Vehicles/large equipment/furniture/outdoor products: prioritize Large Product in Environment; optional Feature Callout.
  - Sale/launch/seasonal pushes: prioritize Discount/Promotional; optionally Social Proof.
- Illustration usage rule:
  - Use illustration only when it plausibly fits brand voice/category. Do not force it for every brand.
- Typography-dominant usage rule:
  - Use when the copy/offer is the hook; keep product secondary but present and credible.
- Funnel guidance:
  - Awareness: Human Lifestyle, Illustration, Large Product in Environment.
  - Consideration: Clean White/Packshot, Feature Callout, UI Mockup, Collection.
  - Conversion: Typography-Dominant, Social Proof, Problem/Solution, Discount/Promotional.

LAYOUT FREEDOM WITH AGENCY RULES (critical):
- Do NOT lock outputs to a small fixed set of archetypes. You have full creative freedom to choose layouts that best fit the product, platform, and message.
- Freedom is allowed only when all core design rules pass: strict hierarchy, clear composition, readable typography, disciplined color roles, and clean CTA flow.
- Never produce random or noisy layouts. Every layout decision must be intentional and explainable by ad-design fundamentals.
- Across the batch, keep a coherent campaign feel (brand system, tone, quality), but vary camera/framing/scene/layout enough that each ad is distinct.

MANDATORY LAYOUT SPEC (write this inside every generated prompt):
- Include one short "Layout blueprint" sentence with explicit placement instructions, e.g.:
  "Layout blueprint: headline top-left in a clean text block, sub-headline directly below, hero product center-right occupying ~40% frame height, CTA bottom-left high-contrast button, logo top-right with clear space."
- Include one short "Typography spec" sentence with relative scale, e.g.:
  "Typography spec: headline bold and largest, sub-headline medium at ~60% headline size, CTA label bold compact."
- Include one short "Readability guardrails" sentence:
  "Readability guardrails: keep all text on low-noise areas, maintain high contrast, avoid text over busy details."
- Include one explicit "Text-safe zone safeguard" sentence:
  "Image must contain clean, low-noise negative space in [specific area] suitable for text overlay — no product, props, or busy background elements in this zone."
- Include one explicit CTA geometry sentence:
  "CTA button spec: rounded rectangle (~12px radius), horizontal padding ~32px, vertical padding ~14px, bold high-contrast label, isolated with whitespace."
- Include one short "Prompt anatomy check" sentence confirming shot type, lighting setup, camera/lens feel, palette roles, composition, and negatives are all explicitly defined.

STYLE REFERENCE REINFORCEMENT (required):
- If a style tag is selected (e.g. signature-premium-product, human-lifestyle, clean-white-packshot), explicitly reinforce it in the prompt body with one sentence: "Style reference: this creative follows [style-tag] characteristics..." plus a concise campaign-quality benchmark.

PROFESSIONAL AD DESIGN RULES (non-negotiable quality gate for every prompt):
- Visual hierarchy (most important): enforce exactly 3 levels of attention — Level 1 Hook (headline or hero product), Level 2 Support (sub-headline/supporting visual), Level 3 Action (CTA). Never let two elements have equal weight.
- Composition: use rule of thirds by default; avoid dead-center except deliberate luxury symmetry. Build for Z-pattern eye flow (top-left to top-right to diagonal to CTA endpoint). Keep 25-30% breathing space.
- Product share and placement: product-focused ads should usually allocate ~45-55% frame area to product (default target); lifestyle variants can reduce to ~15-30% with context as hero. Keep minimum ~10% breathing space around product edges and avoid awkward crops.
- Color discipline: enforce 60-30-10 color role split (dominant/secondary/accent). Accent is mostly CTA/highlights and must not flood the frame.
- Contrast/readability: ensure high text/background contrast and clear CTA contrast. Never place text over busy details. If in doubt, simplify background behind text.
- Typography system: max 2 fonts implied by style direction; clear scale gap (headline > sub-headline > body/CTA text), left-aligned by default unless deliberate brand-led center composition.
- CTA rules: exactly one CTA, 1-3 words, isolated by whitespace, placed at natural endpoint of eye flow (often bottom-right or bottom-left depending composition).
- Lighting and depth: one coherent light direction, realistic soft shadows/contact shadows, clear product-background separation, subtle premium finish (not artificial/glossy overprocessing).
- Category fit: adapt environment and tone by product category (tech, beauty, food, fashion, SaaS, home, wellness, sports, luxury) without using rigid templates.
- Avoid list: clutter, multiple competing hooks, low-contrast text, generic stock-photo feel, random decorative effects, excessive props, harsh pure-black/pure-white backgrounds, more than one CTA.
- 3-second clarity test: in 3 seconds, viewer must understand product, single benefit, and next action.
- Quality bar: outputs should feel like work from a top global agency — polished enough for major brands, with restraint, precision, and premium craft.

VARIANT RULE (across the ${PHOTO_ADS_PROMPT_COUNT} prompts):
- What the ad is about stays from the user (headline, sub-headline, product info). Keep brand color roles consistent.
- Vary: camera angle (front, 3/4, top-down), background treatment, and layout (where headline/CTA sit). Each prompt should be a different creative interpretation of the same message.
- When category-fit, include a controlled mix where some prompts use people/lifestyle context and some remain clean product-focused.
- Include controlled style diversity using the style families above (not random variety). The set should look like one campaign with multiple art-directed executions.

SAFETY CHECK before each prompt:
- Headline, sub-headline, and CTA text explicitly included so they appear in the image?
- One product/setting, one lighting style? Product/reference dominance and limited props? Brand colors by role?

Output: Pure JSON only. Array of exactly ${PHOTO_ADS_PROMPT_COUNT} objects: { "prompt": "full prompt string", "style": "short tag", "layoutNotes": "short layout description" }. No comments or extra keys.`;

function outputSpecForSize(size: GeneratePhotoAdsRequest["size"]): string {
  switch (size) {
    case "story":
      return "Aspect ratio target: 9:16 vertical (stories/mobile). Final output should target at least 2048px on the shortest edge.";
    case "landscape":
      return "Aspect ratio target: 16:9 horizontal (feed/banner). Final output should target at least 2048px on the shortest edge.";
    case "portrait":
      return "Aspect ratio target: 3:4 portrait. Final output should target at least 2048px on the shortest edge.";
    case "square":
    default:
      return "Aspect ratio target: 1:1 square (social feed). Final output should target at least 2048px on the shortest edge.";
  }
}

function buildUserMessage(req: GeneratePhotoAdsRequest, stylePlan: PhotoAdsStyleTag[]): string {
  const productImageBlurb = req.productImageUrl
    ? "YES — A product image is attached (you may see it above for context). We send it to the image model as the first reference image. Every prompt you generate MUST begin with: \"Create an ad using the reference image provided (which shows the product); place that product as the hero. \" Then continue with scene, lighting, and copy. Refer to it only as 'the reference image provided' or 'the provided product photo'; never describe the product's appearance."
    : "NO product image attached. Do not reference any product image. Describe a realistic product from the product information below.";

  const logoBlurb = req.logoUrl
    ? "YES — A logo is attached (you may see it above for context). We send it to the image model as the second reference image. In every prompt explicitly say: \"Use the provided logo in the layout (e.g. top-left or bottom-right).\" Refer to it as 'the logo provided' or 'the provided logo.'"
    : "NO logo attached. Do not mention a logo in the prompts.";

  const styleAssignment = stylePlan
    .map((style, i) => `${i + 1}. ${style}`)
    .join("\n");

  return `The idea for each ad comes only from the information below. You are free to interpret what the perfect ad would look like (layout, style, composition) using this context and the design rules — but what the ad is ABOUT must be the headline, sub-headline, and product/offer info here. Include the exact headline, sub-headline, and CTA text in every prompt so they appear in the generated image.

Product / offer info (this drives the theme and subject of the ad):
${req.productInfo}

Headline (include this exact text in every prompt so it appears in the image):
${req.headline}

Sub-headline (include this exact text in every prompt):
${req.subHeadline || "none"}

Call to action (include this exact CTA text in every prompt, e.g. on a button):
${req.cta}

Brand colors (use by role in every prompt — primary for key shapes/background tints, secondary for accents):
Primary: ${req.brandColors.primary}
Secondary: ${req.brandColors.secondary ?? "none"}

Platform (optional; use to inform ad style when provided): ${req.platform ?? "generic"}

Campaign output format requirement:
${outputSpecForSize(req.size)}

BRAND INTEGRITY LOCK — applies to all outputs in this batch:
- Primary brand color reference: ${req.brandColors.primary}
- Secondary brand color reference: ${req.brandColors.secondary ?? "none"}
- Product and logo fidelity are mandatory: no shape/material/color drift from provided references.
- Copy must be exact and legible in all outputs.
- CTA must always be present and high-contrast; visual style may vary by concept.
- Hero product must remain sharp and clearly readable.

CREATIVE VARIATION GOAL — also mandatory for this batch:
- Maximize style diversity across prompts while preserving brand integrity.
- Vary layout, typography treatment, background family, lighting mood, and camera approach between prompts.
- Do not make the batch look templated or cookie-cutter.

Logo: ${logoBlurb}

Product image: ${productImageBlurb}

TASK:
Generate exactly ${PHOTO_ADS_PROMPT_COUNT} prompts. Each prompt must: (1) be about the product and message above, (2) include the exact headline, sub-headline, and CTA text so they are visible in the ad, (3) use brand colors by role, (4) follow the design rules. If product image is provided, every prompt MUST start with: \"Create an ad using the reference image provided (which shows the product); place that product as the hero. \" then continue with the rest. If logo is provided, include \"Use the provided logo in the layout (e.g. top-left or bottom-right).\" (Nano Banana receives first image = product, second image = logo.) If neither is provided, ignore reference images entirely and describe the product from the product info. Vary layout, camera angle, and background across the ${PHOTO_ADS_PROMPT_COUNT} prompts.
First, perform the internal PRODUCT ANALYSIS STEP and derive category-correct creative variables. Then generate prompts from those derived variables.
Also: each prompt must include (a) an explicit "Layout blueprint" sentence with placements, (b) a short "Typography spec" sentence, and (c) a "Readability guardrails" sentence. You may choose any layout style as long as all professional design rules are satisfied.
Also: each prompt must explicitly include the full prompt anatomy in order (shot type, subject/product, placement, environment/background, lighting, camera/lens, mood, color palette, quality style, composition directive, negatives). Keep negatives compatible with required ad text/logo.
Also: in lighting, explicitly include key + fill + rim + contact shadow. In camera, include camera body + lens + aperture. In mood, include a viewer emotional response. In style, include at least 5 quality boosters. If people are present, describe them specifically.
Also: include a "Text-safe zone safeguard" sentence and a "Style reference" sentence that reinforces the selected style tag inside the prompt body.
Also: if humans are present, include explicit crop framing guidance (e.g., mid-thigh-up/waist-up/chest-up) and ensure head + product are fully in frame. If grid motifs are used, explicitly restrict them to non-text zones only. If accent rim light is used, specify its color/intensity clearly and keep it subtle.
Also: include a consistent batch finishing standard in each prompt (vignette intensity, grain level, color-grade direction, contrast behavior).
Also: apply Category Visual DNA + Category Layout DNA for this product. Use category-native layout language and include the required final "This ad should feel like a real [category] brand campaign — ..." sentence in every prompt.
When appropriate for the product category, include controlled variety in the batch: some prompts may use people/lifestyle context while others stay product-centric; some can use brand-color-heavy backgrounds while others use clean white/neutral backgrounds with brand accents.
Style mix requirement for this batch: include at least one "signature-premium-product" prompt, plus at least two prompts from different style families when category-fit. Candidate families: "human-lifestyle", "illustrated-graphic", "clean-white-packshot", "typography-dominant", "social-proof-trust", "feature-callout-infographic", "problem-solution", "ui-saas-mockup", "discount-promotional", "large-product-environment", "multi-product-collection". Avoid forcing illustration when not suitable. Do not force all families in one batch.

MANDATORY STYLE ASSIGNMENT (index -> style tag):
${styleAssignment}

You MUST follow the exact style tag assignment above for each corresponding prompt index (1..${PHOTO_ADS_PROMPT_COUNT}). Avoid repeating the same visual formula across adjacent prompts.

Return only valid JSON: an array of ${PHOTO_ADS_PROMPT_COUNT} objects with keys "prompt", "style", "layoutNotes". Use concise style tags from: signature-premium-product, human-lifestyle, illustrated-graphic, clean-white-packshot, typography-dominant, social-proof-trust, feature-callout-infographic, problem-solution, ui-saas-mockup, discount-promotional, large-product-environment, multi-product-collection. No other text.`;
}

/** Returns image prompts (strings) for Nano Banana Pro. */
export async function generateImagePrompts(
  req: GeneratePhotoAdsRequest,
  options?: { model?: GeminiPhotoAdsModel }
): Promise<string[]> {
  const stylePlan = buildStylePlan(req, PHOTO_ADS_PROMPT_COUNT);
  const userMessage = buildUserMessage(req, stylePlan);

  const images: Array<{ mimeType: string; data: string }> = [];
  if (isRealImageUrl(req.productImageUrl)) {
    const productImg = await fetchImageAsInline(req.productImageUrl!.trim());
    if (productImg) images.push(productImg);
  }
  if (isRealImageUrl(req.logoUrl)) {
    const logoImg = await fetchImageAsInline(req.logoUrl!.trim());
    if (logoImg) images.push(logoImg);
  }

  const raw = await geminiGenerateContent(userMessage, {
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: "application/json",
    images: images.length > 0 ? images : undefined,
    model: options?.model,
  });

  const trimmed = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let arr: { prompt?: string; style?: string; layoutNotes?: string }[];
  try {
    arr = JSON.parse(trimmed) as { prompt?: string; style?: string; layoutNotes?: string }[];
  } catch {
    throw new Error("Gemini did not return valid JSON for image prompts");
  }

  if (!Array.isArray(arr) || arr.length < PHOTO_ADS_PROMPT_COUNT) {
    throw new Error(`Gemini returned ${arr?.length ?? 0} prompts; need ${PHOTO_ADS_PROMPT_COUNT}`);
  }

  const selected = arr.slice(0, PHOTO_ADS_PROMPT_COUNT).map((item, i) => {
    const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
    const rawStyle = typeof item?.style === "string" ? item.style.trim() : "";
    const parsedStyle = normalizeStyleTag(rawStyle);
    const requiredStyle = stylePlan[i] ?? "signature-premium-product";
    const style = parsedStyle ?? requiredStyle;
    const layoutNotes = typeof item?.layoutNotes === "string" ? item.layoutNotes.trim() : "";
    const styleDirective = styleExecutionDirective(requiredStyle);
    const withStyleReference = prompt.includes("Style reference:")
      ? prompt
      : `Style reference: this creative follows ${style} characteristics with premium campaign-level execution.\n${prompt}`;
    const enforcedPrompt = `${styleDirective}\n${withStyleReference}`;
    if (parsedStyle && parsedStyle !== requiredStyle) {
      console.warn(
        `[photo-ads][gemini] style mismatch on prompt ${i + 1}: got "${parsedStyle}", expected "${requiredStyle}". Keeping required style for enforcement.`
      );
    }
    return {
      prompt: enforcedPrompt || "Professional ad creative, high contrast, clear composition.",
      style: style || requiredStyle,
      layoutNotes: layoutNotes || "",
    };
  });

  // Debug logging: print exact prompts returned by Gemini for inspection.
  console.log("[photo-ads][gemini] generated prompt set start");
  selected.forEach((item, idx) => {
    console.log(
      `[photo-ads][gemini] prompt ${idx + 1}/${selected.length} | requiredStyle=${stylePlan[idx]} | style=${item.style} | layoutNotes=${item.layoutNotes || "(none)"}`
    );
    console.log(item.prompt);
  });
  console.log("[photo-ads][gemini] generated prompt set end");

  return selected.map((item) => item.prompt);
}

const SUGGEST_EDIT_SYSTEM = `You are an ad creative expert. Given an ad image, suggest 3–5 short, concrete improvement prompts the user could use to edit the image with an image-editing API. Each suggestion should be one clear instruction (e.g. "Make the background warmer", "Soften the shadows under the product", "Add more contrast to the headline text"). Return only a JSON array of strings, no other text. Example: ["Make the background warmer","Soften the shadows","Increase contrast on the CTA button"]`;

/** Returns 3–5 short edit suggestions for an ad image (for use with Nano Banana Edit). */
export async function suggestEditPrompts(imageUrl: string): Promise<string[]> {
  const img = await fetchImageAsInline(imageUrl.trim());
  if (!img) throw new Error("Could not fetch image for suggestions");

  const raw = await geminiGenerateContent(
    "Look at this ad image and suggest 3–5 short improvement prompts as described in your instructions. Return only a JSON array of strings.",
    {
      systemInstruction: SUGGEST_EDIT_SYSTEM,
      responseMimeType: "application/json",
      images: [img],
    }
  );

  const trimmed = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let arr: string[];
  try {
    arr = JSON.parse(trimmed) as string[];
  } catch {
    throw new Error("Gemini did not return valid JSON for edit suggestions");
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => String(s).trim()).slice(0, 5);
}
