// @vitest-environment happy-dom
// @ts-ignore vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-ignore testing-library is resolved in new-app; root tsc does not include its test types
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/app/motion-studio/new' }))

import { MotionStudioCreate } from '../../components/motion-studio/motion-studio-create'
import { createMockMotionStudioClient } from '../../lib/motion-studio/mock-client'

afterEach(() => cleanup())

describe('Motion Studio create screen (FE-1)', () => {
  it('renders the exact concept labels, no timeline, no media picker, no currency', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const { container } = render(<MotionStudioCreate client={client} initialView="create" />)
    expect(screen.getByText('Motion Studio')).toBeTruthy()
    expect(screen.getByText('My projects')).toBeTruthy()
    expect(screen.getByText('What are we creating today?')).toBeTruthy()
    expect(screen.getByText('Create original videos, animated graphics, ads, and stories from an idea, script, or footage.')).toBeTruthy()
    expect(screen.getByPlaceholderText('Describe what you want to make. Add a story, brand direction, photos or footage.')).toBeTruthy()
    expect(screen.getByText('Add photos, footage, script or audio')).toBeTruthy()
    expect(screen.getByText('Start with idea')).toBeTruthy()
    expect(screen.getByTestId('ms-video-type')).toBeTruthy()
    expect(screen.getByTestId('ms-creative-style')).toBeTruthy()
    expect(screen.getByTestId('ms-brand-mode')).toBeTruthy()
    expect(screen.getByText('Use a script')).toBeTruthy()
    expect(screen.getByText('Edit my footage')).toBeTruthy()
    expect(screen.queryByText('Where should we get the media?')).toBeNull()
    expect(screen.queryByTestId('ms-tracks')).toBeNull()
    expect(container.textContent).not.toMatch(/\$/)
  })

  it('shows the later media picker with its three labels only behind the flag', () => {
    render(<MotionStudioCreate client={createMockMotionStudioClient({ storage: null })} initialView="create" mediaPickerEnabled />)
    expect(screen.getByText('Where should we get the media?')).toBeTruthy()
    expect(screen.getByText('Find media automatically + use my uploads')).toBeTruthy()
    expect(screen.getByText('Find photos and videos automatically')).toBeTruthy()
    expect(screen.getByText('Use only my uploaded media')).toBeTruthy()
  })

  it('Start creates a project with structured creative metadata and opens the workspace', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const spy = vi.spyOn(client, 'createProject')
    render(<MotionStudioCreate client={client} initialView="create" />)
    fireEvent.change(screen.getByTestId('ms-prompt'), { target: { value: 'Describe what you want to make. Add a story, brand direction, photos or footage.' } })
    fireEvent.click(screen.getByTestId('ms-start'))
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(spy.mock.calls[0]![0]).toMatchObject({ workflow: 'idea', mediaPolicy: 'auto_plus_uploads', creative: { videoType: 'anything', brandMode: 'none' } })
    expect(String(push.mock.calls.at(-1)![0])).toMatch(/^\/app\/motion-studio\/ms_/)
  })

  it('lists projects with the Example project badge', async () => {
    render(<MotionStudioCreate client={createMockMotionStudioClient({ storage: null })} initialView="projects" />)
    await waitFor(() => expect(screen.getByTestId('ms-projects')).toBeTruthy())
    expect(screen.getByText('Example project')).toBeTruthy()
    expect(screen.getByTestId('ms-vision').textContent).toContain('Give Transovo an idea.')
  })

  it('makes the whole Example project card one real link with nothing on top taking the click', async () => {
    render(<MotionStudioCreate client={createMockMotionStudioClient({ storage: null })} initialView="projects" />)
    const card = await screen.findByTestId('ms-project-card')
    expect(card.tagName).toBe('A')
    expect(card.getAttribute('href')).toBe('/app/motion-studio/ms_example_documentary')
    expect(card.textContent).toContain('Example documentary')
    expect(card.textContent).toContain('Example project')
    // Every child layer is decorative; the anchor itself is the hit target.
    for (const child of Array.from(card.children)) expect(child.className).toContain('pointer-events-none')
    expect(card.querySelector('button, a, [role="button"]')).toBeNull()
    // Code-rendered cover, no hotlinked image.
    expect(card.querySelector('[data-testid="ms-poster"]')?.getAttribute('data-kind')).toBe('chart')
    expect(card.querySelector('img')).toBeNull()
  })
})
