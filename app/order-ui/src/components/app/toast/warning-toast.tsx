import { AlertTriangle } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export function WarningToast({ title, description }: Props) {
  return (
    <div className="flex gap-3 items-center rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-amber-500 px-4 py-3 shadow-md w-[360px]">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        {description && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
    </div>
  )
}
