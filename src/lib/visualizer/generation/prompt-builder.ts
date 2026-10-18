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
  materialName?: string | null;
  materialDescription?: string | null;
  bathroomPhotoDescription?: string | null;
  enclosureStyle?: string | null;
  baseStyle?: string | null;
  fixtureFinish?: string | null;
  preserveVanity?: boolean;
  preserveWindow?: boolean;
  preserveDoor?: boolean;
  /** Shower / tub-surround panel height in the wet area (launch wizard). */
  showerWallHeight?: ShowerWallHeight | null;
  /** When true, prepends revision guidance (same room / viewpoint). */
  isRevision?: boolean;
  /** Third reference image: etched tile/block geometry (Pioneer Plus, Monterey tile). */
  hasSurfacePatternReference?: boolean;
};

function referenceImageGuideBlock(hasSurfacePatternReference: boolean): string {
  if (hasSurfacePatternReference) {
    return `Image A (first reference) is the original bathroom photograph — preserve its layout, camera angle, and non-selected surfaces.
Image B (second reference) is the exact color and finish authority for the selected wall panel — match hue, brightness, saturation, undertone, veining, and speckle from the panel face in this image as literally as possible.
Image C (third reference) is the exact pattern / etching / block-layout authority only — copy grout line scale, running-bond layout, and large-block geometry from this image, then recolor using Image B. Do not copy Image C's gray, white, or outdoor color cast.`;
  }
  return `Image A (first reference) is the original bathroom photograph — preserve layout and perspective.
Image B (second reference) is the exact color and finish authority for the selected wall panel — match the swatch literally, not an approximate or stylized interpretation.`;
}

const MATERIAL_COLOR_FIDELITY_BLOCK = `Material color fidelity (critical):
Use the selected wall-panel reference as a literal product sample, not inspiration. Preserve the material's original hue, value (lightness), saturation, and undertone from the swatch.
Do not significantly darken, lighten, cool, warm, or stylize the panel color to match bathroom shadows or mood lighting.
If room lighting would normally deepen shadows, keep the installed panel color visually true to the reference while still looking naturally lit.
Do not substitute generic marble, generic tile, generic travertine, or generic slate when a specific product swatch was provided.
Preserve etched, scored, laser-etched, or large-block panel details from the references — do not smooth them into a flat painted wall.
Output must remain a photorealistic remodeled bathroom photograph, not a 3D render or illustration.`;

function sharedBasePrompt(hasSurfacePatternReference: boolean): string {
  return `You are generating a photorealistic bathroom remodel mockup from a real bathroom photo.
${referenceImageGuideBlock(hasSurfacePatternReference)}
Preserve the original room's blueprint, dimensions, perspective, camera angle, window placement, door placement, ceiling, ventilation location, and overall layout. Keep the bathroom recognizable as the same room.
Perform only the requested remodel transformation.
Match the selected material's color, veining, tone, and texture as closely as possible from Image B, but interpret it as professionally installed bathroom wall panels / finished bathroom surfaces.
Ignore any printed text, labels, logos, branding, or sample-card markings in the material image. Do not reproduce brand names or labels in the output.
Keep the result realistic, clean, construction-complete, and visually believable.
Do not create a collage, split-screen, before/after comparison, text overlay, watermark, or caption.
Do not redesign unrelated parts of the room unless necessary for a coherent finished remodel.
Preserve existing permanent room elements as much as possible, especially the vanity, mirror, lighting, window, trim, and door, unless the requested remodel absolutely requires small adjustments.
Do not change the room into a different bathroom. Keep the same footprint and architectural structure.`;
}

const TUB_TO_SHOWER_BLOCK = `Convert the existing bathtub area into a shower in the same exact footprint and location.
Remove the tub and replace it with a finished shower base / shower pan that fits the same alcove or placement.
Install the selected wall material on the shower walls only, inside the shower wet area.
Keep the rest of the bathroom outside the shower area as unchanged as possible.
If there is a window in or near the shower wall, keep it in the same location and finish the surrounding area realistically.
Add a realistic shower fixture set on the appropriate plumbing wall.
Add a clean, realistic shower enclosure appropriate for the space. If no enclosure style is specified, use a simple clear glass enclosure or panel that suits the room.
Do not leave a bathtub. This must clearly read as a shower conversion.
Do not apply the selected wall material across the entire bathroom. Restrict it to the new shower area unless another instruction specifically expands it.
Keep the vanity, sink, mirror, door, ceiling, and overall room structure consistent with the original bathroom.
The final result should look like the same bathroom after a professional tub-to-shower remodel.`;

const TUB_TO_TUB_BLOCK = `Keep this as a bathtub layout. Do not convert it into a shower-only space.
Remodel the existing tub area while preserving the same general footprint and room layout.
Replace or refresh the tub surround using the selected wall material around the tub area only.
Keep the bathtub present and clearly recognizable as a tub installation.
If a showerhead exists above the tub or the room naturally supports a tub/shower combination, keep the setup realistic for a finished tub installation.
Do not extend the selected wall material across unrelated bathroom walls unless required to complete the tub surround.
Keep the rest of the room as unchanged as possible, especially the vanity, mirror, window, door, and room proportions.
The final result should look like the same bathroom after a professional tub remodel, not a full-room redesign.`;

const SHOWER_TO_SHOWER_BLOCK = `This bathroom already has a shower. Keep it a shower — do not convert it to a tub and do not remove the shower.
Preserve the existing shower footprint, plumbing wall, and overall shower location.
Replace the shower wall surfaces inside the wet area with the selected wall-panel material only (finished acrylic/composite wall panels — not ceramic tile on the walls).
Keep or update the shower base/pan and enclosure realistically for the same shower opening; do not relocate the shower.
Do not apply the selected wall material to the entire bathroom — restrict it to the shower surround walls inside the shower area.
Do not add ceramic wall tile, subway tile, or decorative tile patterns on shower walls unless the selected material itself is tile-look paneling.
The bathroom floor may keep existing flooring or simple floor tile if already present; do not redesign the whole floor unless required for a believable shower threshold.
Keep the vanity, window, door, mirror, and room architecture as unchanged as possible outside the shower.
The final result should look like the same bathroom after a professional shower wall-panel replacement, not a new room.`;

const SHOWER_TO_TUB_BLOCK = `Convert the existing shower area into a bathtub installation in the same general footprint and location.
Remove the shower-only setup and install a finished bathtub that fits the space realistically.
Use the selected wall material for the new tub surround / surrounding wet walls.
Keep plumbing on a believable wall and keep the room layout recognizable as the same bathroom.
Keep the rest of the bathroom as unchanged as possible, including the window, vanity, mirror, door, and overall architecture.
Do not turn this into a shower-only remodel. This must clearly read as a tub installation.
Do not spread the selected material across the entire bathroom unless needed to complete the tub surround.
The final result should look like the same bathroom after a professional shower-to-tub remodel.`;

const SHOWER_AND_TUB_DECK_WRAP_BLOCK = `This bathroom contains both a shower and a separate bathtub.
Preserve that layout. Do not remove the tub and do not remove the shower.
Apply the selected material to the shower walls in the shower area.
Also use that same material to wrap the tub deck and the tub-facing surround surfaces only — including the horizontal tub deck and the vertical tub apron / front face / immediate tub surround surfaces that physically touch the tub.
Very important: do not continue that material upward onto the large surrounding walls above the tub deck.
The wall area above the tub deck should remain painted wall, drywall, or the room's existing non-wet wall finish unless another instruction explicitly says otherwise.
In other words, the material should wrap the tub itself and its immediate deck/apron surfaces, not climb the entire wall around the tub.
Keep the shower and tub as separate features in the same bathroom.
Preserve the original bathroom layout, window, door, vanity, and camera perspective.
Keep the result realistic and construction-complete, like a professionally remodeled bathroom using the selected material in the shower and on the tub deck only.`;

const HARD_CONSTRAINTS_BLOCK = `Additional constraints:

* Do not change the camera angle.
* Do not change the room's blueprint or make the room look like a completely different space.
* Do not add extra windows or doors.
* Do not reproduce any sample-card text, logos, or labels from the material image.
* Do not apply the selected material to every wall unless the specific transformation requires it.
* Do not create a fantasy design; keep it realistic and construction-feasible.
* Do not produce a before/after layout or any text overlays.
* Keep the remodeled result clean and professionally staged.`;

/** Maps legacy DB/UI enum values to the four launch transformation prompts. */
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

function transformationBlock(transformation: VisualizerTransformation): string {
  switch (transformation) {
    case "TUB_TO_SHOWER":
      return TUB_TO_SHOWER_BLOCK;
    case "SHOWER_TO_SHOWER":
      return SHOWER_TO_SHOWER_BLOCK;
    case "TUB_TO_TUB":
      return TUB_TO_TUB_BLOCK;
    case "SHOWER_TO_TUB":
      return SHOWER_TO_TUB_BLOCK;
    case "SHOWER_AND_TUB_DECK_WRAP":
      return SHOWER_AND_TUB_DECK_WRAP_BLOCK;
    default:
      return TUB_TO_SHOWER_BLOCK;
  }
}

function showerWallHeightBlock(
  transformation: VisualizerTransformation,
  height: ShowerWallHeight,
): string {
  const fullCeiling =
    "Install the selected wall panels from the shower pan, tub deck, or base upward through the full shower/tub-surround wet area all the way to the ceiling line. The paneling must meet the ceiling realistically with clean trim or a finished transition — never stop short with a painted gap, wallpaper strip, or exposed prior wall finish between the panel top edge and the ceiling. Within the wet zone, replace all wallpaper, borders, and old paint on shower/tub-surround walls with the selected panel material.";
  const eightFt =
    "Install the selected wall panels from the shower pan, tub deck, or base upward only to approximately 8 feet (96 inches) height in the wet area. Above that 8-foot line, keep the existing wall finish (paint, drywall, or prior surface) visible at the top of the shower or tub surround. Do not panel all the way to the ceiling unless the room ceiling is below 8 feet.";

  const scope =
    transformation === "SHOWER_AND_TUB_DECK_WRAP"
      ? "Apply this panel height rule to the shower walls in the shower area only. The tub deck/apron wrap rules elsewhere still apply — do not extend shower-height paneling onto the large wall area above the tub deck."
      : transformation === "TUB_TO_TUB"
        ? "Apply this panel height rule to the tub surround / wet walls around the bathtub only."
        : "Apply this panel height rule to the shower wall surfaces inside the shower wet area (and tub surround walls if this remodel includes a tub wet wall).";

  const body = height === "EIGHT_FT" ? eightFt : fullCeiling;
  return `\n\nShower / surround wall panel height:\n${scope}\n${body}`;
}

export function normalizeShowerWallHeight(value: unknown): ShowerWallHeight {
  if (value === "EIGHT_FT" || value === "FULL_CEILING") return value;
  return "FULL_CEILING";
}

function appendOptionalStyleBlocks(input: BuildVisualizerPromptInput): string {
  const parts: string[] = [];

  if (input.materialName?.trim()) {
    parts.push(`Selected material product name for appearance matching: ${input.materialName.trim()}.`);
  }
  if (input.materialDescription?.trim()) {
    parts.push(`Material notes: ${input.materialDescription.trim()}.`);
  }
  if (input.bathroomPhotoDescription?.trim()) {
    parts.push(`Bathroom context: ${input.bathroomPhotoDescription.trim()}.`);
  }

  if (input.enclosureStyle?.trim()) {
    parts.push(`Use a ${input.enclosureStyle.trim()} shower enclosure.`);
  } else {
    parts.push("Use a clean, simple clear-glass shower enclosure appropriate for the room.");
  }

  if (input.baseStyle?.trim()) {
    parts.push(`Use a ${input.baseStyle.trim()} shower base or tub base style where applicable.`);
  }

  if (input.fixtureFinish?.trim()) {
    parts.push(
      `Use fixtures with a ${input.fixtureFinish.trim()} finish, while keeping them realistic and appropriate for the bathroom.`,
    );
  }

  const preserve: string[] = [];
  if (input.preserveVanity !== false) preserve.push("vanity and sink");
  if (input.preserveWindow !== false) preserve.push("window placement");
  if (input.preserveDoor !== false) preserve.push("door placement");
  if (preserve.length) {
    parts.push(`Especially preserve ${preserve.join(", ")} from the original bathroom photo.`);
  }

  if (input.showerWallHeight) {
    const transformation = normalizeVisualizerTransformation(String(input.transformation));
    parts.push(
      showerWallHeightBlock(transformation, normalizeShowerWallHeight(input.showerWallHeight)).trim(),
    );
  }

  return parts.length ? `\n\n${parts.join("\n")}` : "";
}

export function buildVisualizerPrompt(input: BuildVisualizerPromptInput): string {
  const transformation = normalizeVisualizerTransformation(String(input.transformation));
  const revisionPrefix = input.isRevision
    ? "Revise the previous remodel concept while keeping the same bathroom composition, camera angle, and room layout. "
    : "";

  return (
    revisionPrefix +
    sharedBasePrompt(Boolean(input.hasSurfacePatternReference)) +
    "\n\n" +
    transformationBlock(transformation) +
    appendOptionalStyleBlocks(input) +
    "\n\n" +
    MATERIAL_COLOR_FIDELITY_BLOCK +
    "\n\n" +
    HARD_CONSTRAINTS_BLOCK
  );
}

/** @deprecated Use buildVisualizerPrompt — kept for imports during migration. */
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

  const wall = byCategory("WALL_PANEL") || input.materialRows?.[0];

  return buildVisualizerPrompt({
    transformation: input.transformation,
    materialName: wall?.name || input.selectedMaterials.find((m) => m.name)?.name,
    materialDescription: wall?.description,
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
}

export type GenerationPreserveFlags = {
  camera_viewpoint?: boolean;
  window?: boolean;
  door_positions?: boolean;
  ceiling?: boolean;
  untargeted_vanity?: boolean;
  room_proportions?: boolean;
};
