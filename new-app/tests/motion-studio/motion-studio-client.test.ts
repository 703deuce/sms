// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { createMockMotionStudioClient, MOCK_TIMING } from '../../lib/motion-studio/mock-client'
import { buildMotionTracks } from '../../lib/motion-studio/timeline'
import { MS_LABELS, MS_MEDIA_PICKER_ENABLED, MS_TRACK_LABELS, selectedWorkflowLine } from '../../lib/motion-studio/config'
import { formatMsCredits } from '../../lib/motion-studio/format'
import { buildSidebarNav } from '../../lib/sidebar-nav'

function clock(start = 1_700_000_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

const ALL = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }

describe('Motion Studio mock adapter (contract simulation)', () => {
  it('runs create → plan → checkpoint → approve → review → export without paid calls', async () => {
    const c = clock()
    const client = createMockMotionStudioClient({ now: c.now, storage: null, seedExample: false })
    const created = await client.createProject({
      workflow: 'footage',
      prompt: 'Make a 3-minute documentary about the history of artificial intelligence.',
      uploads: [
        { uploadId: 'u1', kind: 'video', label: 'interview.mp4' },
        { uploadId: 'u2', kind: 'photo', label: 'lab.jpg' },
      ],
      mediaPolicy: 'uploads_only',
      idempotencyKey: 'k1',
    })
    expect(created.status).toBe('setup')
    expect(created.mediaPolicy).toBe('uploads_only')
    expect(created.settings.lengthMin).toBe(3)
    // Same idempotency key → same project.
    const again = await client.createProject({ workflow: 'footage', prompt: 'x', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'k1' })
    expect(again.id).toBe(created.id)

    const planned = await client.createPlan(created.id, 'p1')
    expect(planned.status).toBe('planning')
    expect(planned.scenes.length).toBe(15)
    expect(planned.scenes.some((s) => s.handoff)).toBe(true)
    c.advance(MOCK_TIMING.plan + 10)
    const waiting = await client.getProject(created.id)
    expect(waiting.status).toBe('awaiting_review')
    expect(waiting.stages.find((s) => s.id === 'story')?.status).toBe('needs_review')

    await client.approveStory(created.id)
    const run1 = await client.startProduction(created.id, 'checkpoint', 'r1')
    const run2 = await client.startProduction(created.id, 'checkpoint', 'r2')
    expect(run2.status).toBe(run1.status) // duplicate start → same run
    c.advance(planned.scenes.length * MOCK_TIMING.sceneMs + MOCK_TIMING.assemble + 10)
    const review = await client.getProject(created.id)
    expect(review.status).toBe('review')
    expect(review.scenes.every((s) => s.status === 'ready')).toBe(true)

    const activity = await client.listActivity(created.id)
    expect(activity.events.some((e) => e.kind === 'reasoning')).toBe(true)

    await client.startExport(created.id, 'e1')
    c.advance(MOCK_TIMING.export + 10)
    const done = await client.getProject(created.id)
    expect(done.export.status).toBe('ready')
    expect(done.status).toBe('complete')

    // No currency anywhere in what the UI renders.
    expect(JSON.stringify(done)).not.toMatch(/\$/)
  })

  it('fully automatic runs to review with no stop; regenerate touches one scene only', async () => {
    const c = clock()
    const client = createMockMotionStudioClient({ now: c.now, storage: null, seedExample: false })
    const p = await client.createProject({ workflow: 'idea', prompt: 'Make a documentary about the Apollo program', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'k2' })
    await client.updateProject(p.id, { settings: { productionMode: 'auto' } })
    const planned = await client.createPlan(p.id, 'p')
    await client.startProduction(p.id, 'auto', 'r')
    c.advance(MOCK_TIMING.plan + planned.scenes.length * MOCK_TIMING.sceneMs + MOCK_TIMING.assemble + 10)
    expect((await client.getProject(p.id)).status).toBe('review')
    const target = planned.scenes[4]!
    const after = await client.regenerateScene(p.id, target.id, null, 'g1')
    expect(after.scenes.filter((s) => s.status === 'rendering').map((s) => s.id)).toEqual([target.id])
  })

  it('director proposals apply nothing until accepted', async () => {
    const c = clock()
    const client = createMockMotionStudioClient({ now: c.now, storage: null, seedExample: false })
    const p = await client.createProject({ workflow: 'idea', prompt: 'about the moon landing', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'k3' })
    await client.createPlan(p.id, 'p')
    const before = (await client.getProject(p.id)).scenes.map((s) => s.version)
    const withProposal = await client.sendDirectorMessage(p.id, 'The opening is too slow and the chart is hard to read.')
    const proposal = withProposal.proposals[0]!
    expect(proposal.items.every((i) => i.status === 'pending')).toBe(true)
    expect(withProposal.scenes.map((s) => s.version)).toEqual(before)
    const accepted = await client.decideProposal(p.id, proposal.id, 'all', 'accept')
    expect(accepted.proposals[0]!.items.every((i) => i.status === 'accepted')).toBe(true)
    expect(accepted.scenes[0]!.version).toBe(before[0]! + 1)
  })

  it('script workflow keeps the user words verbatim', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const script = 'In 1969 two astronauts walked on the Moon.\n\nThe world watched live.'
    const p = await client.createProject({ workflow: 'script', prompt: '', script, uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'k4' })
    const planned = await client.createPlan(p.id, 'p')
    const words = planned.story!.chapters.flatMap((c) => c.lines.map((l) => l.text)).join('\n\n')
    expect(words).toBe(script)
    expect(planned.story!.preservedUserScript).toBe(true)
  })
})

describe('Motion Studio config, tracks and nav', () => {
  it('builds the Motion Studio lanes with exact labels and splits handoffs', () => {
    const client = createMockMotionStudioClient({ storage: null })
    return client.listProjects().then(async (list) => {
      const example = await client.getProject(list.find((x) => x.isExample)!.id)
      const { tracks } = buildMotionTracks(example)
      expect(tracks.map((t) => t.label)).toEqual([MS_TRACK_LABELS.scenes, 'VIDEO', 'GRAPHICS', 'VOICE', 'MUSIC'])
      expect(tracks[0]!.items.length).toBe(example.scenes.length)
    })
  })

  it('selected workflow line covers the 3 modes × uploads_only', () => {
    expect(selectedWorkflowLine('idea')).toMatchInlineSnapshot(`"Selected workflow: Transovo will research the topic, write the script, use the photos, images and clips you upload, and produce a 5-minute documentary."`)
    expect(selectedWorkflowLine('script', { uploads: 2 })).toMatchInlineSnapshot(`"Selected workflow: Transovo will keep your script word for word, use your 2 uploaded files, design the motion graphics, and produce a 5-minute documentary."`)
    expect(selectedWorkflowLine('footage', { lengthMin: 3, uploads: 1 })).toMatchInlineSnapshot(`"Selected workflow: Transovo will analyze your footage, use your 1 uploaded file, add motion graphics where they help the story, and produce a 3-minute documentary."`)
  })

  it('keeps the v1 rules: picker hidden, credits only, exact concept labels', () => {
    expect(MS_MEDIA_PICKER_ENABLED).toBe(false)
    expect(formatMsCredits(null)).toBe('Credits TBD')
    expect(formatMsCredits(12)).toBe('12 credits')
    expect(MS_LABELS.headline).toBe('What are we creating today?')
    expect(MS_LABELS.promptPlaceholder).toBe('Make a documentary about the GameStop short squeeze in 2021.')
    for (const v of Object.values(MS_LABELS)) expect(v).not.toMatch(/\$/)
  })

  it('adds Motion Studio to the sidebar without touching AI Studio or Ad Studio', () => {
    const nav = buildSidebarNav(ALL)
    expect(nav.find((i) => i.id === 'motion-studio')).toMatchObject({ href: '/app/motion-studio', label: 'Motion Studio' })
    expect(nav.find((i) => i.id === 'studio')?.href).toBe('/app/studio')
    expect(nav.find((i) => i.id === 'ad-studio')?.href).toBe('/app/ad-studio')
  })
})
