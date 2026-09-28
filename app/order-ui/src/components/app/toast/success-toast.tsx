import { CheckCircle2 } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export function SuccessToast({ title, description }: Props) {
  return (
    <div className="flex gap-3 items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-lg w-[360px]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
    </div>
  )
}
