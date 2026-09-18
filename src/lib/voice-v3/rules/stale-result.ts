import type { VoiceV3CallContext } from "../call-context/types";

/** Drop async tool / search results that belong to a superseded generation. */
export function isStaleToolResult(
  ctx: VoiceV3CallContext,
  resultToolGeneration: number,
): boolean {
  return resultToolGeneration < ctx.generations.tool;
}

export function isStaleAvailabilityResult(
  ctx: VoiceV3CallContext,
  resultSearchGeneration: number,
): boolean {
  return resultSearchGeneration < ctx.generations.availabilitySearch;
}

export function bumpToolGeneration(ctx: VoiceV3CallContext): VoiceV3CallContext {
  return {
    ...ctx,
    generations: {
      ...ctx.generations,
      tool: ctx.generations.tool + 1,
    },
  };
}

export function bumpAvailabilitySearchGeneration(ctx: VoiceV3CallContext): VoiceV3CallContext {
  return {
    ...ctx,
    generations: {
      ...ctx.generations,
      availabilitySearch: ctx.generations.availabilitySearch + 1,
    },
    currentOfferSet: undefined,
    selectedSlotId: undefined,
  };
}
