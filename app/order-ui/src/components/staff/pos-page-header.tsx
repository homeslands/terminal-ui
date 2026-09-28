import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Props {
  backTo: string
  backLabel?: string
  onBack?: () => void
  center?: ReactNode
  right?: ReactNode
  printHidden?: boolean
}

export function PosPageHeader({ backTo, backLabel = '←', onBack, center, right, printHidden }: Props) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-2.5',
        printHidden && 'print:hidden',
      )}
    >
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-pos-muted hover:text-pos-gold">
          {backLabel}
        </button>
      ) : (
        <Link to={backTo} className="text-sm text-pos-muted hover:text-pos-gold">
          {backLabel}
        </Link>
      )}
      <div>{center}</div>
      <div>{right}</div>
    </header>
  )
}
