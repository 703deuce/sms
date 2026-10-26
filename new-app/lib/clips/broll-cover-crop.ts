/** object-fit: cover math for preview/render (uses intrinsic video dimensions). */
export function brollCoverCropStyle(
  parentWidth: number,
  parentHeight: number,
  videoWidth: number,
  videoHeight: number,
): { width: number; height: number; left: number; top: number } | null {
  if (!parentWidth || !parentHeight || !videoWidth || !videoHeight) return null
  const scale = Math.max(parentWidth / videoWidth, parentHeight / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  return {
    width,
    height,
    left: (parentWidth - width) / 2,
    top: (parentHeight - height) / 2,
  }
}
