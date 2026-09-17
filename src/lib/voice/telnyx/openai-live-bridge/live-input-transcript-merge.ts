/**
 * Merge Live input_transcript payloads without double-appending cumulative snapshots.
 */

export type TranscriptMergeMode = "append" | "replace" | "noop" | "reset";

export type TranscriptMergeResult = {
  text: string;
  mode: TranscriptMergeMode;
};

export type TranscriptMergeOptions = {
  /** Provider item/content identity — new id ⇒ new utterance segment. */
  contentId?: string;
  previousContentId?: string;
};

export function mergeLiveInputTranscriptText(
  currentBuffer: string,
  incoming: string,
  opts?: TranscriptMergeOptions,
): TranscriptMergeResult {
  const delta = incoming;
  if (!delta) {
    return { text: currentBuffer, mode: "noop" };
  }

  if (
    opts?.contentId &&
    opts.previousContentId &&
    opts.contentId !== opts.previousContentId
  ) {
    return { text: delta, mode: "reset" };
  }

  if (!currentBuffer) {
    return { text: delta, mode: "replace" };
  }

  if (delta === currentBuffer) {
    return { text: currentBuffer, mode: "noop" };
  }

  if (currentBuffer === delta) {
    return { text: currentBuffer, mode: "noop" };
  }

  // Cumulative snapshot (full text so far).
  if (delta.startsWith(currentBuffer)) {
    const rest = delta.slice(currentBuffer.length);
    if (rest.startsWith(currentBuffer)) {
      return { text: currentBuffer + rest.slice(currentBuffer.length), mode: "replace" };
    }
    return { text: delta, mode: "replace" };
  }

  // Duplicate tail re-send.
  if (currentBuffer.endsWith(delta)) {
    return { text: currentBuffer, mode: "noop" };
  }

  return { text: currentBuffer + delta, mode: "append" };
}
