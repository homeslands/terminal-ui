import { useRef, type TouchEvent } from 'react'

interface IUseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

/**
 * Handle swipe gestures (tablet/mobile). Return handlers to attach to the target element.
 * `onTouchStart`/`onTouchEnd` work together to detect swipe direction and distance.
 *
 * `threshold` is the minimum horizontal distance (in pixels) for a swipe to be recognized. Default is 60px.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: IUseSwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.changedTouches[0].clientX
    startY.current = e.changedTouches[0].clientY
  }

  const onTouchEnd = (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - startX.current
    const deltaY = e.changedTouches[0].clientY - startY.current

    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return

    if (deltaX < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return { onTouchStart, onTouchEnd }
}
