export function streamReadyEmailHtml(input: {
  title: string
  clipTitles: string[]
  projectUrl: string
}) {
  const clips =
    input.clipTitles.length > 0
      ? `<ul>${input.clipTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
      : '<p>Your highlights are ready.</p>'
  return `<!DOCTYPE html><html><body style="font-family:sans-serif">
  <h2>Clips ready — ${escapeHtml(input.title)}</h2>
  ${clips}
  <p><a href="${escapeHtml(input.projectUrl)}">Open project</a></p>
  </body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
