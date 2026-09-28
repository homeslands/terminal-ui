import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ScrollWheel } from '@/components/ui'

const ITEM_HEIGHT = 40
const options = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: String(hour).padStart(2, '0'),
}))

const renderWheel = (value = 0, onChange = vi.fn()) => {
  render(
    <ScrollWheel
      label="Hour"
      options={options}
      value={value}
      onChange={onChange}
      itemHeight={ITEM_HEIGHT}
    />,
  )
  return { list: screen.getByRole('listbox', { name: 'Hour' }), onChange }
}

/**
 * jsdom has no PointerEvent constructor, so fireEvent.pointerDown drops
 * pointerType/clientY. Build the event by hand — React reads those fields
 * straight off the native event.
 */
const pointer = (
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { clientY?: number; button?: number } = {},
) =>
  fireEvent(
    el,
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      pointerType: 'mouse',
      button: 0,
      ...init,
    }),
  )

/**
 * Stands in for react-remove-scroll: a modal ancestor cancels wheel/touchmove
 * for anything outside its own subtree (a portaled popover included).
 */
const lockScroll = () => {
  const cancel = (event: Event) => {
    if (event.cancelable) event.preventDefault()
  }
  document.addEventListener('wheel', cancel, { capture: true })
  document.addEventListener('touchmove', cancel, { capture: true })
  return () => {
    document.removeEventListener('wheel', cancel, { capture: true })
    document.removeEventListener('touchmove', cancel, { capture: true })
  }
}

let releaseLock: (() => void) | null = null
afterEach(() => {
  releaseLock?.()
  releaseLock = null
})

describe('ScrollWheel scrolling', () => {
  it('scrolls on the mouse wheel under a scroll lock', () => {
    const { list } = renderWheel()
    releaseLock = lockScroll()

    fireEvent.wheel(list, { deltaY: 120 })

    expect(list.scrollTop).toBe(120)
  })

  it('translates line-mode wheel deltas into rows', () => {
    const { list } = renderWheel()
    releaseLock = lockScroll()

    fireEvent.wheel(list, { deltaY: 2, deltaMode: 1 })

    expect(list.scrollTop).toBe(2 * ITEM_HEIGHT)
  })

  it('scrolls on the mouse wheel with no lock in sight, exactly once', () => {
    const { list } = renderWheel()

    const event = new Event('wheel', { bubbles: true, cancelable: true })
    Object.assign(event, { deltaY: 3 * ITEM_HEIGHT, deltaMode: 0 })
    fireEvent(list, event)

    // We own the gesture: three rows, and the browser is told to stand down
    // so it cannot scroll the same three rows again.
    expect(list.scrollTop).toBe(3 * ITEM_HEIGHT)
    expect(event.defaultPrevented).toBe(true)
  })

  it('scrolls itself on touch drag when a scroll lock cancels touchmove', () => {
    const { list } = renderWheel()
    releaseLock = lockScroll()

    fireEvent.touchStart(list, { touches: [{ clientY: 200 }] })
    fireEvent.touchMove(list, { touches: [{ clientY: 150 }] })

    expect(list.scrollTop).toBe(50)
  })

  it('scrolls on mouse drag and swallows the click it ends on', () => {
    const onChange = vi.fn()
    const { list } = renderWheel(0, onChange)

    pointer(list, 'pointerdown', { clientY: 200 })
    pointer(list, 'pointermove', { clientY: 140 })
    pointer(list, 'pointerup')

    expect(list.scrollTop).toBe(60)

    // The pointerup landed on a row; that click must not select it.
    fireEvent.click(screen.getByRole('option', { name: '05' }))
    expect(onChange).not.toHaveBeenCalled()

    // The next click is a real one again.
    fireEvent.click(screen.getByRole('option', { name: '05' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('ignores a press that never moved, so plain clicks still select', () => {
    const onChange = vi.fn()
    renderWheel(0, onChange)

    fireEvent.click(screen.getByRole('option', { name: '03' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})

describe('ScrollWheel wheel accumulation', () => {
  it('banks trackpad deltas until they add up to a whole row', () => {
    const { list } = renderWheel()
    releaseLock = lockScroll()

    // Each tick is smaller than a row: mandatory snap would eat it.
    fireEvent.wheel(list, { deltaY: 12 })
    fireEvent.wheel(list, { deltaY: 12 })
    expect(list.scrollTop).toBe(0)

    fireEvent.wheel(list, { deltaY: 12 })
    fireEvent.wheel(list, { deltaY: 12 })
    expect(list.scrollTop).toBe(ITEM_HEIGHT)
  })

  it('drops the banked delta when the direction flips', () => {
    const { list } = renderWheel()
    releaseLock = lockScroll()

    fireEvent.wheel(list, { deltaY: 3 * ITEM_HEIGHT })
    expect(list.scrollTop).toBe(3 * ITEM_HEIGHT)

    fireEvent.wheel(list, { deltaY: 30 }) // banked, not yet a row
    fireEvent.wheel(list, { deltaY: -30 }) // flip: the +30 is dropped
    fireEvent.wheel(list, { deltaY: -30 }) // -60 banked -> one row up
    expect(list.scrollTop).toBe(2 * ITEM_HEIGHT)
  })
})
