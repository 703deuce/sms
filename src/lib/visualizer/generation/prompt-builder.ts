export type SelectedMaterialRef = {
  materialId?: string;
  category: string;
  name?: string;
};

export type VisualizerTransformation =
  | "TUB_TO_SHOWER"
  | "SHOWER_TO_SHOWER"
  | "TUB_TO_TUB"
  | "SHOWER_TO_TUB"
  | "SHOWER_AND_TUB_DECK_WRAP";

export type ShowerWallHeight = "FULL_CEILING" | "EIGHT_FT";

export type BuildVisualizerPromptInput = {
  transformation: VisualizerTransformation | string;
  /** Ignored for appearance — reference photographs are the visual authority. */
  materialName?: string | null;
  /** @deprecated Not injected into provider prompts. */
  materialDescription?: string | null;
  bathroomPhotoDescription?: string | null;
  enclosureStyle?: string | null;
  baseStyle?: string | null;
  fixtureFinish?: string | null;
  preserveVanity?: boolean;
  preserveWindow?: boolean;
  preserveDoor?: boolean;
  showerWallHeight?: ShowerWallHeight | null;
  isRevision?: boolean;
  /** When true, append the single Image 3 pattern sentence (must match uploaded refs). */
  hasSurfacePatternReference?: boolean;
};

const PATTERN_IMAGE_LINE =
  "Use Image 3 for the etched block pattern and scale; keep Image 2 as the color reference.";

const PRESERVE_DEFAULT =
  "Preserve the room layout, camera angle, window, vanity, and other unaffected features.";

const MATCH_MATERIAL = "matching its color and pattern closely";

function showerWallHeightSentence(height: ShowerWallHeight): string {
  if (height === "EIGHT_FT") {
    return "Run wall panels to about 8 feet in the wet area; keep the existing finish above.";
  }
  return "Run wall panels from base to ceiling in the wet area.";
}

function appendUserSelections(input: BuildVisualizerPromptInput): string {
  const parts: string[] = [];
  if (input.enclosureStyle?.trim()) {
    parts.push(`Use a ${input.enclosureStyle.trim()} shower enclosure.`);
  }
  if (input.baseStyle?.trim()) {
    parts.push(`Use a ${input.baseStyle.trim()} shower base or tub base where applicable.`);
  }
  if (input.fixtureFinish?.trim()) {
    parts.push(`Use ${input.fixtureFinish.trim()} fixtures.`);
  }
  if (input.showerWallHeight) {
    parts.push(showerWallHeightSentence(normalizeShowerWallHeight(input.showerWallHeight)));
  }
  if (input.bathroomPhotoDescription?.trim()) {
    parts.push(input.bathroomPhotoDescription.trim());
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function appendPatternLine(hasSurfacePatternReference: boolean): string {
  return hasSurfacePatternReference ? ` ${PATTERN_IMAGE_LINE}` : "";
}

function transformationPrompt(
  transformation: VisualizerTransformation,
  hasSurfacePatternReference: boolean,
): string {
  const pattern = appendPatternLine(hasSurfacePatternReference);

  switch (transformation) {
    case "TUB_TO_SHOWER":
      return (
        `Convert the bathtub in Image 1 into a walk-in shower in the same location. ${PRESERVE_DEFAULT} ` +
        `Use Image 2 as the reference for the selected shower wall material, ${MATCH_MATERIAL} ` +
        `Apply it only to the shower walls. Add a realistic shower base and enclosure.` +
        pattern +
        ` Photorealistic finished bathroom.`
      );
    case "TUB_TO_TUB":
      return (
        `Remodel the bathtub in Image 1 as a new bathtub installation in the same location. ${PRESERVE_DEFAULT} ` +
        `Use Image 2 as the reference for the selected tub-surround wall material, ${MATCH_MATERIAL} ` +
        `Apply it only to the tub-surround walls. Keep the bathtub clearly visible.` +
        pattern +
        ` Photorealistic finished bathroom.`
      );
    case "SHOWER_TO_TUB":
      return (
        `Convert the existing shower in Image 1 into a bathtub installation in the same area. ${PRESERVE_DEFAULT} ` +
        `Use Image 2 as the reference for the new tub-surround wall material, ${MATCH_MATERIAL} ` +
        `Apply the material only to the tub-surround walls.` +
        pattern +
        ` Photorealistic finished bathroom.`
      );
    case "SHOWER_TO_SHOWER":
      return (
        `Keep the shower in Image 1 in the same location. ${PRESERVE_DEFAULT} ` +
        `Use Image 2 as the reference for the shower wall material, ${MATCH_MATERIAL} ` +
        `Apply it only to the shower walls inside the wet area.` +
        pattern +
        ` Photorealistic finished bathroom.`
      );
    case "SHOWER_AND_TUB_DECK_WRAP":
      return (
        `Keep the separate shower and bathtub in Image 1 in their original locations. ${PRESERVE_DEFAULT} ` +
        `Apply the material from Image 2 to the shower walls and to the bathtub's horizontal deck and front apron. ${MATCH_MATERIAL} ` +
        `Do not extend it up the walls above the bathtub deck.` +
        pattern +
        ` Photorealistic finished bathroom.`
      );
    default:
      return transformationPrompt("TUB_TO_SHOWER", hasSurfacePatternReference);
  }
}

/** Maps legacy DB/UI enum values to launch transformation prompts. */
export function normalizeVisualizerTransformation(value: string): VisualizerTransformation {
  switch (value) {
    case "TUB_TO_SHOWER":
    case "SHOWER_TO_SHOWER":
    case "TUB_TO_TUB":
    case "SHOWER_TO_TUB":
    case "SHOWER_AND_TUB_DECK_WRAP":
      return value;
    case "SHOWER_REPLACEMENT":
    case "WALL_PANEL_UPGRADE":
      return "SHOWER_TO_SHOWER";
    case "BATHROOM_REFRESH":
      return "TUB_TO_TUB";
    case "CUSTOM":
    default:
      return "TUB_TO_SHOWER";
  }
}

export function normalizeShowerWallHeight(value: unknown): ShowerWallHeight {
  if (value === "EIGHT_FT" || value === "FULL_CEILING") return value;
  return "FULL_CEILING";
}

export function buildVisualizerPrompt(input: BuildVisualizerPromptInput): string {
  const transformation = normalizeVisualizerTransformation(String(input.transformation));
  const hasPattern = Boolean(input.hasSurfacePatternReference);

  let prompt = transformationPrompt(transformation, hasPattern);
  prompt += appendUserSelections(input);

  if (input.isRevision) {
    prompt =
      "Refine the previous remodel preview while keeping the same room layout and camera angle. " +
      prompt;
  }

  return prompt.replace(/\s+/g, " ").trim();
}

export function buildVisualizerEditPrompt(input: {
  transformation: string;
  selectedMaterials: SelectedMaterialRef[];
  additionalInstructions?: string | null;
  preserve?: GenerationPreserveFlags;
  showerWallHeight?: ShowerWallHeight | null;
  isRevision?: boolean;
  hasSurfacePatternReference?: boolean;
  materialRows?: Array<{
    id: string;
    name: string;
    category: string;
    description?: string | null;
    finish?: string | null;
  }>;
}): string {
  const byCategory = (cat: string) =>
    input.materialRows?.find((m) =>
      input.selectedMaterials.some((s) => s.materialId === m.id && s.category === cat),
    ) ||
    input.materialRows?.find((m) => m.category === cat);

  let prompt = buildVisualizerPrompt({
    transformation: input.transformation,
    enclosureStyle: byCategory("DOOR")?.name || byCategory("DOOR")?.finish,
    baseStyle: byCategory("SHOWER_BASE")?.name,
    fixtureFinish: byCategory("FIXTURE")?.finish || byCategory("FIXTURE")?.name,
    preserveVanity: input.preserve?.untargeted_vanity ?? true,
    preserveWindow: input.preserve?.window ?? true,
    preserveDoor: input.preserve?.door_positions ?? true,
    showerWallHeight: input.showerWallHeight as ShowerWallHeight | undefined,
    isRevision: input.isRevision,
    hasSurfacePatternReference: input.hasSurfacePatternReference,
  });

  const extra = input.additionalInstructions?.trim();
  if (extra) {
    prompt = `${prompt} ${extra}`;
  }

  return prompt;
}

export type GenerationPreserveFlags = {
  camera_viewpoint?: boolean;
  window?: boolean;
  door_positions?: boolean;
  ceiling?: boolean;
  untargeted_vanity?: boolean;
  room_proportions?: boolean;
};

/** @internal — expose final templates for tests and audit reports. */
export function visualizerTransformationPromptForTests(
  transformation: VisualizerTransformation,
  hasSurfacePatternReference = false,
): string {
  return transformationPrompt(transformation, hasSurfacePatternReference);
}
