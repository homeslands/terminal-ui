import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ScrollWheelOption<T extends string | number> {
  value: T
  label: string
  /** Rendered but not selectable — the wheel snaps past it. */
  disabled?: boolean
}

export interface ScrollWheelProps<T extends string | number> {
  options: ScrollWheelOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  /** Row height in px. Drives the wheel height and the snap grid. */
  itemHeight?: number
  /** Rows visible at once. Coerced to an odd number so one row is centered. */
  visibleCount?: number
  disabled?: boolean
  /** Accessible name of the wheel (e.g. "Hour"). */
  label?: string
  className?: string
  itemClassName?: string
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

/** Pixels of mouse travel before a press counts as a drag, not a click. */
const DRAG_THRESHOLD = 3

/**
 * A single vertically scrollable wheel: CSS scroll-snap keeps one row
 * centered, rows fade and tilt away from the center, and the value is
 * committed once scrolling settles. Disabled rows are skipped by snapping
 * to the closest selectable neighbour.
 *
 * It owns no time/date semantics — it is a generic picker column.
 */
export function ScrollWheel<T extends string | number>({
  options,
  value,
  onChange,
  itemHeight = 40,
  visibleCount = 5,
  disabled = false,
  label,
  className,
  itemClassName,
}: ScrollWheelProps<T>) {
  const rowCount = visibleCount % 2 === 0 ? visibleCount + 1 : visibleCount
  const padRows = (rowCount - 1) / 2
  const height = rowCount * itemHeight

  const listRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number | null>(null)
  const settleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const userScrollingRef = React.useRef(false)
  const touchYRef = React.useRef<number | null>(null)
  const dragRef = React.useRef<{
    startY: number
    startTop: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = React.useRef(false)
  const wheelAccRef = React.useRef(0)
  const wheelTargetRef = React.useRef<number | null>(null)

  // `offset` is the float index currently under the center band. It drives
  // the fade/tilt of every row, so it is kept in state; the ref mirror lets
  // the settle timeout read it without re-subscribing.
  const [offset, setOffset] = React.useState(0)
  const offsetRef = React.useRef(0)

  const selectedIndex = React.useMemo(() => {
    const index = options.findIndex((option) => option.value === value)
    return index === -1 ? 0 : index
  }, [options, value])

  // Latest props for the deferred (timeout) settle handler.
  const latest = React.useRef({ options, value, onChange })
  React.useEffect(() => {
    latest.current = { options, value, onChange }
  })

  const nearestEnabledIndex = React.useCallback(
    (index: number) => {
      const list = latest.current.options
      if (list.length === 0) return -1
      const start = clamp(index, 0, list.length - 1)
      if (!list[start]?.disabled) return start
      for (let step = 1; step < list.length; step++) {
        const after = start + step
        if (after < list.length && !list[after].disabled) return after
        const before = start - step
        if (before >= 0 && !list[before].disabled) return before
      }
      return -1
    },
    [],
  )

  const scrollToIndex = React.useCallback(
    (index: number, smooth: boolean) => {
      const el = listRef.current
      if (!el) return
      const top = index * itemHeight
      // jsdom (and very old browsers) have no Element.scrollTo.
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
      } else {
        el.scrollTop = top
      }
      // Smooth scrolls report their progress through scroll events; a jump
      // may not fire one at all (first paint, jsdom), so place it by hand.
      if (!smooth) {
        offsetRef.current = index
        setOffset(index)
      }
    },
    [itemHeight],
  )

  const select = React.useCallback(
    (index: number, smooth = true) => {
      const target = nearestEnabledIndex(index)
      if (target === -1) return
      scrollToIndex(target, smooth)
      const option = latest.current.options[target]
      if (option && option.value !== latest.current.value) {
        latest.current.onChange(option.value)
      }
    },
    [nearestEnabledIndex, scrollToIndex],
  )

  const handleSettle = React.useCallback(() => {
    userScrollingRef.current = false
    wheelTargetRef.current = null
    wheelAccRef.current = 0
    select(Math.round(offsetRef.current))
  }, [select])

  const handleScroll = React.useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const next = el.scrollTop / itemHeight
        offsetRef.current = next
        setOffset(next)
      })
    }
    if (settleRef.current) clearTimeout(settleRef.current)
    settleRef.current = setTimeout(handleSettle, 120)
  }, [handleSettle, itemHeight])

  const markUserScrolling = React.useCallback(() => {
    userScrollingRef.current = true
  }, [])

  const scrollBy = React.useCallback((delta: number) => {
    const el = listRef.current
    if (el) el.scrollTop += delta
  }, [])

  /**
   * Mouse wheel, owned outright. A non-passive listener on the scroller lets
   * us preventDefault, so this works identically whether or not a modal
   * ancestor (Radix Dialog/Popover wrap their content in react-remove-scroll)
   * has already cancelled the event, and the row never double-scrolls.
   * stopPropagation keeps the gesture off the scroll container behind us.
   */
  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      if (disabled) return
      event.preventDefault()
      event.stopPropagation()
      markUserScrolling()

      const unit =
        event.deltaMode === 1
          ? itemHeight // lines
          : event.deltaMode === 2
            ? rowCount * itemHeight // pages
            : 1 // pixels
      const delta = event.deltaY * unit
      // Bank deltas smaller than a row so fine trackpad ticks aren't lost.
      if (delta * wheelAccRef.current < 0) wheelAccRef.current = 0
      wheelAccRef.current += delta
      const rows = Math.trunc(wheelAccRef.current / itemHeight)
      if (rows === 0) return
      wheelAccRef.current -= rows * itemHeight

      const count = latest.current.options.length
      if (count === 0) return
      // Step from the row the last notch aimed at, so spinning fast while the
      // previous glide is still running keeps counting instead of stalling.
      const base = wheelTargetRef.current ?? Math.round(offsetRef.current)
      const next = clamp(base + rows, 0, count - 1)
      wheelTargetRef.current = next
      scrollToIndex(next, true)
    },
    [disabled, itemHeight, markUserScrolling, rowCount, scrollToIndex],
  )

  React.useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      markUserScrolling()
      touchYRef.current = event.touches[0]?.clientY ?? null
    },
    [markUserScrolling],
  )

  const handleTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const y = event.touches[0]?.clientY
      if (y == null) return
      const previous = touchYRef.current
      touchYRef.current = y
      if (disabled || previous == null || !event.defaultPrevented) return
      scrollBy(previous - y)
    },
    [disabled, scrollBy],
  )

  // Mouse drag. The browser never scrolls on a mouse drag, so this is purely
  // additive — and it works no matter who owns the scroll lock.
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      markUserScrolling()
      if (disabled || event.pointerType !== 'mouse' || event.button !== 0) return
      const el = listRef.current
      if (!el) return
      dragRef.current = {
        startY: event.clientY,
        startTop: el.scrollTop,
        moved: false,
      }
    },
    [disabled, markUserScrolling],
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      const el = listRef.current
      if (!drag || !el) return
      const travelled = event.clientY - drag.startY
      if (!drag.moved && Math.abs(travelled) < DRAG_THRESHOLD) return
      drag.moved = true
      el.scrollTop = drag.startTop - travelled
    },
    [],
  )

  const endDrag = React.useCallback(() => {
    // Swallow the click a drag ends on, so letting go over a row does not
    // pick that row.
    if (dragRef.current?.moved) suppressClickRef.current = true
    dragRef.current = null
  }, [])

  // Keep the wheel aligned with the controlled value (including first paint),
  // but never yank it away from the finger mid-scroll.
  React.useLayoutEffect(() => {
    if (userScrollingRef.current) return
    const el = listRef.current
    if (!el) return
    const distance = Math.abs(el.scrollTop - selectedIndex * itemHeight)
    if (distance < 1) return
    // A short distance means the native snap is still animating towards the
    // row we just committed — glide with it instead of jumping.
    scrollToIndex(selectedIndex, distance < itemHeight * 2)
  }, [selectedIndex, itemHeight, scrollToIndex])

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (settleRef.current) clearTimeout(settleRef.current)
    },
    [],
  )

  const move = React.useCallback(
    (delta: number) => {
      const list = latest.current.options
      let index = selectedIndex
      for (let step = 0; step < list.length; step++) {
        index += delta
        if (index < 0 || index >= list.length) return
        if (!list[index].disabled) {
          select(index)
          return
        }
      }
    },
    [select, selectedIndex],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'PageUp':
        event.preventDefault()
        move(-padRows)
        break
      case 'PageDown':
        event.preventDefault()
        move(padRows)
        break
      case 'Home':
        event.preventDefault()
        select(0)
        break
      case 'End':
        event.preventDefault()
        select(options.length - 1)
        break
      default:
        break
    }
  }

  const spacerStyle = { height: padRows * itemHeight }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onScroll={disabled ? undefined : handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        'scrollbar-hide relative flex-1 select-none snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md outline-none',
        'focus-visible:ring-1 focus-visible:ring-ring',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      style={{
        height,
        perspective: '640px',
        // Fade the rows above and below the centered value.
        maskImage:
          'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
      }}
    >
      <div style={spacerStyle} aria-hidden />
      {options.map((option, index) => {
        const delta = index - offset
        const distance = Math.abs(delta)
        const outside = distance > padRows + 0.5
        const isSelected = index === selectedIndex
        return (
          <button
            key={String(option.value)}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              if (!option.disabled) select(index)
            }}
            className={cn(
              'flex w-full snap-center items-center justify-center text-base tabular-nums transition-colors',
              isSelected
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground',
              option.disabled && 'text-muted-foreground/40 line-through',
              !option.disabled && 'cursor-pointer',
              itemClassName,
            )}
            style={{
              height: itemHeight,
              opacity: outside ? 0 : Math.max(0, 1 - distance * 0.3),
              transform: `rotateX(${clamp(delta * -20, -66, 66)}deg) scale(${Math.max(0.7, 1 - distance * 0.1)})`,
              pointerEvents: outside ? 'none' : undefined,
            }}
          >
            {option.label}
          </button>
        )
      })}
      <div style={spacerStyle} aria-hidden />
    </div>
  )
}

ScrollWheel.displayName = 'ScrollWheel'
