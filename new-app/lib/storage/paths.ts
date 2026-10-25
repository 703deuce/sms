export function uploadSourceKey(workspaceId: string, uploadId: string, ext: string) {
  return `ws/${workspaceId}/uploads/${uploadId}/source.${ext}`
}

export function projectWordsKey(workspaceId: string, projectId: string) {
  return `ws/${workspaceId}/projects/${projectId}/words.json`
}

export function projectProxyKey(workspaceId: string, projectId: string) {
  return `ws/${workspaceId}/projects/${projectId}/proxy_720.mp4`
}

export function projectThumbKey(workspaceId: string, projectId: string) {
  return `ws/${workspaceId}/projects/${projectId}/thumb.jpg`
}
