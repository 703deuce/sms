// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useRef, useState } from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useDismiss } from '@/components/clips/editor/use-dismiss'

function Menu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  useDismiss(ref, open, () => {
    onClose()
    setOpen(false)
  })
  return (
    <div>
      <div ref={ref} data-testid="menu">
        {open ? <button data-testid="item">Text track</button> : null}
      </div>
      <button data-testid="outside">elsewhere</button>
    </div>
  )
}

describe('FV4e useDismiss (+ Track menu)', () => {
  afterEach(() => cleanup())
  it('closes on an outside pointer-down', () => {
    const onClose = vi.fn()
    const { getByTestId, queryByTestId } = render(<Menu onClose={onClose} />)
    fireEvent.pointerDown(getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(queryByTestId('item')).toBeNull()
  })
  it('does not close on a click inside the menu', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Menu onClose={onClose} />)
    fireEvent.pointerDown(getByTestId('item'))
    expect(onClose).not.toHaveBeenCalled()
  })
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Menu onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
