import { Bell, X } from 'lucide-react'

interface Props {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

/**
 * Toast template for incoming notifications (FCM / native). Matches the
 * Success/Warning/Error template family (same width, radius, dark-mode
 * tokens) but uses a brass-tinted bell icon + optional action button so
 * it reads as "informational with CTA" rather than success/error.
 */
export function NotificationToast({
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
}: Props) {
  return (
    <div className="flex gap-3 items-start rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-lg w-[360px]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pos-gold/15 dark:bg-pos-gold/20 shrink-0">
        <Bell className="h-4 w-4 text-pos-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {description}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 text-xs font-semibold text-pos-gold hover:underline focus:outline-none focus:underline"
          >
            {actionLabel} →
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng"
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
