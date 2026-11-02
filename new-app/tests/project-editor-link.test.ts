import { describe, expect, it } from 'vitest'
import {
  buildOpenInEditorHref,
  openInEditorLinkLabel,
  resolveEditorProjectId,
} from '@/lib/clips/project-editor-link'

describe('project-editor-link', () => {
  it('resolveEditorProjectId falls back to route id when polled id is null/undefined', () => {
    expect(resolveEditorProjectId('proj_route', null)).toBe('proj_route')
    expect(resolveEditorProjectId('proj_route', undefined)).toBe('proj_route')
    expect(resolveEditorProjectId('proj_route', 'null')).toBe('proj_route')
  })

  it('resolveEditorProjectId prefers valid polled id', () => {
    expect(resolveEditorProjectId('proj_route', 'proj_poll')).toBe('proj_poll')
  })

  it('buildOpenInEditorHref never uses null project segment when route id is present', () => {
    expect(
      buildOpenInEditorHref({
        routeProjectId: 'proj_a342ad46984345f786014b7f8526fb4c',
        editorProjectId: null,
        clipId: 'clip_1',
      }),
    ).toBe('/app/clips/proj_a342ad46984345f786014b7f8526fb4c/edit/clip_1')

    expect(
      buildOpenInEditorHref({
        routeProjectId: 'proj_route',
        editorProjectId: undefined,
        clipId: undefined,
      }),
    ).toBeNull()

    expect(
      buildOpenInEditorHref({
        routeProjectId: 'proj_route',
        editorProjectId: null,
        clipId: null,
      }),
    ).toBeNull()
  })

  it('openInEditorLinkLabel uses spoken language label', () => {
    expect(openInEditorLinkLabel('es')).toBe('Open spanish in editor')
    expect(openInEditorLinkLabel('en')).toBe('Open english in editor')
  })
})
