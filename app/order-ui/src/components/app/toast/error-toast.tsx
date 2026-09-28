import { XCircle } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export function ErrorToast({ title, description }: Props) {
  return (
    <div className="flex gap-3 items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-lg w-[360px]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40 shrink-0">
        <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
    </div>
  )
}
