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

/** Maps UI `showerWallHeight` to installation coverage (reuse existing field — no new DB/UI). */
export type VisualizerCoverageMode = "TO_CEILING" | "SURROUND_HEIGHT";

export type BuildVisualizerPromptInput = {
  transformation: VisualizerTransformation | string;
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
  hasSurfacePatternReference?: boolean;
};

const PATTERN_IMAGE_LINE =
  "Use Image 3 for the etched block pattern and scale; keep Image 2 as the color reference.";

const PRESERVE =
  "Preserve the room layout, camera angle, window, vanity, lighting, and other unaffected features.";

const MATERIAL_REF =
  "Use Image 2 as the selected wall-panel material. Match Image 2's wall-panel color and pattern faithfully, without darkening the base color.";

const PHOTO = "Photorealistic finished bathroom.";

export function coverageModeFromShowerWallHeight(height: ShowerWallHeight): VisualizerCoverageMode {
  return height === "EIGHT_FT" ? "SURROUND_HEIGHT" : "TO_CEILING";
}

/** Installation rule — injected immediately after the transformation sentence. */
export function buildCoverageInstruction(
  transformation: VisualizerTransformation,
  coverageMode: VisualizerCoverageMode,
): string {
  const toCeiling = "Extend the wall panels all the way to the ceiling.";
  const partial =
    "Stop the wall panels at the selected surround height (about 8 feet), leaving the existing wall finish above the panel line.";

  switch (transformation) {
    case "TUB_TO_SHOWER":
      return coverageMode === "TO_CEILING"
        ? `Apply the selected wall-panel material on the shower walls and ${toCeiling.charAt(0).toLowerCase()}${toCeiling.slice(1)}`
        : `Apply the selected wall-panel material on the shower walls only up to the surround height, and keep painted wall above the panel line.`;

    case "SHOWER_TO_SHOWER":
      return coverageMode === "TO_CEILING"
        ? `Apply the selected wall-panel material on the shower walls inside the wet area and ${toCeiling.charAt(0).toLowerCase()}${toCeiling.slice(1)}`
        : `Apply the selected wall-panel material on the shower walls only up to the surround height, and keep painted wall above the panel line.`;

    case "TUB_TO_TUB":
      return coverageMode === "TO_CEILING"
        ? `Apply the selected wall-panel material around the tub-surround walls and ${toCeiling.charAt(0).toLowerCase()}${toCeiling.slice(1)}`
        : `Apply the selected wall-panel material around the tub-surround only up to the surround height, and keep painted wall above the panel line.`;

    case "SHOWER_TO_TUB":
      return coverageMode === "TO_CEILING"
        ? `Apply the selected wall-panel material around the new tub-surround walls and ${toCeiling.charAt(0).toLowerCase()}${toCeiling.slice(1)}`
        : `Apply the selected wall-panel material around the tub-surround only up to the surround height, and keep painted wall above the panel line.`;

    case "SHOWER_AND_TUB_DECK_WRAP": {
      const showerCoverage =
        coverageMode === "TO_CEILING"
          ? `Extend the selected shower wall panels all the way to the ceiling.`
          : `Stop the shower wall panels at the selected surround height, leaving the existing wall finish above.`;
      return (
        `${showerCoverage} ` +
        `Also apply the same material only on the bathtub horizontal deck and front apron. ` +
        `Do not continue that material up the tub-side upper walls above the deck.`
      );
    }
    default:
      return buildCoverageInstruction("TUB_TO_SHOWER", coverageMode);
  }
}

function transformationOpening(transformation: VisualizerTransformation): string {
  switch (transformation) {
    case "TUB_TO_SHOWER":
      return "Convert the bathtub in Image 1 into a walk-in shower in the same location.";
    case "TUB_TO_TUB":
      return "Remodel the bathtub in Image 1 as a new bathtub installation in the same location. Keep the bathtub clearly visible.";
    case "SHOWER_TO_TUB":
      return "Convert the existing shower in Image 1 into a bathtub installation in the same area.";
    case "SHOWER_TO_SHOWER":
      return "Keep the shower in Image 1 in the same location.";
    case "SHOWER_AND_TUB_DECK_WRAP":
      return "Keep the separate shower and bathtub in Image 1 in their original locations.";
    default:
      return transformationOpening("TUB_TO_SHOWER");
  }
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
  if (input.bathroomPhotoDescription?.trim()) {
    parts.push(input.bathroomPhotoDescription.trim());
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function buildCorePrompt(
  transformation: VisualizerTransformation,
  coverageMode: VisualizerCoverageMode,
  hasSurfacePatternReference: boolean,
): string {
  const parts = [
    transformationOpening(transformation),
    buildCoverageInstruction(transformation, coverageMode),
    MATERIAL_REF,
    PRESERVE,
  ];

  if (transformation === "TUB_TO_SHOWER") {
    parts.push("Add a realistic shower base and enclosure.");
  }

  let prompt = `${parts.join(" ")}`;
  if (hasSurfacePatternReference) {
    prompt += ` ${PATTERN_IMAGE_LINE}`;
  }
  prompt += ` ${PHOTO}`;
  return prompt;
}

/** Maps legacy DB/UI enum values to the launch transformation prompts. */
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
  const coverageMode = coverageModeFromShowerWallHeight(
    normalizeShowerWallHeight(input.showerWallHeight ?? "FULL_CEILING"),
  );
  const hasPattern = Boolean(input.hasSurfacePatternReference);

  let prompt = buildCorePrompt(transformation, coverageMode, hasPattern);
  prompt += appendUserSelections(input);

  if (input.isRevision) {
    prompt =
      "Refine the previous remodel preview while keeping the same room layout, camera angle, and wall-panel height setting. " +
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
    showerWallHeight: input.showerWallHeight ?? "FULL_CEILING",
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

/** @internal — full prompt for tests (defaults: full ceiling, no Image 3). */
export function buildVisualizerPromptForTests(
  transformation: VisualizerTransformation,
  showerWallHeight: ShowerWallHeight = "FULL_CEILING",
  hasSurfacePatternReference = false,
): string {
  return buildVisualizerPrompt({
    transformation,
    showerWallHeight,
    hasSurfacePatternReference,
  });
}
