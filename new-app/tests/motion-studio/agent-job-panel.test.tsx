// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AgentJobPanel, type MotionAgentJob } from '../../components/motion-studio/agent-job-panel'

afterEach(cleanup)
const job: MotionAgentJob = {
  id: 'msaj_test', projectId: 'msp_test', status: 'running', phase: 'scenes',
  progress: 35, message: 'Building your scenes', stages: ['research','story','scenes','complete'],
}
describe('Motion Studio chat visibility', () => {
  it('shows the assistant during first production, before a video is complete', () => {
    render(<AgentJobPanel job={job} />)
    expect(screen.getByTestId('ms-agent-chat')).toBeTruthy()
  })
  it('lets the workspace own the adjacent assistant without duplicate chat', () => {
    render(<AgentJobPanel job={job} showChat={false} />)
    expect(screen.queryByTestId('ms-agent-chat')).toBeNull()
  })
})
