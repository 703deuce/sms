/** Clip editor route — immersive chrome (no AppTopBar). */
export function isClipEditRoute(pathname: string): boolean {
  return /^\/app\/clips\/[^/]+\/edit\/[^/]+/.test(pathname)
}
