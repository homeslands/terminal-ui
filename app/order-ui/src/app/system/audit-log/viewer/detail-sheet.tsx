import { useMemo } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { Copy, X } from 'lucide-react'

import { AuditEventBadge } from '@/components/app/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { IAuditLog } from '@/types'

interface IProps {
  log: IAuditLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
  configMap?: Map<string, string>
}

// ---------------------------------------------------------------------------
// Sensitive field masking (applied recursively before stringify)
// ---------------------------------------------------------------------------
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'secret',
  'otp',
  'pin',
  'cvv',
])

function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.has(k.toLowerCase()) ? '••••••••' : maskSensitive(v),
      ]),
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// LCS-based line diff
// ---------------------------------------------------------------------------
type LineStatus = 'matched' | 'unmatched'

/** Compute LCS length table for two string arrays. */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

/**
 * Given two arrays of lines, return a LineStatus[] for each side.
 * 'matched' means the line has a counterpart in the LCS; 'unmatched' means it doesn't.
 */
function diffLines(
  aLines: string[],
  bLines: string[],
): { aStatus: LineStatus[]; bStatus: LineStatus[] } {
  const dp = lcsTable(aLines, bLines)
  const aMatched = new Array(aLines.length).fill(false)
  const bMatched = new Array(bLines.length).fill(false)

  // Backtrack to find which indices are in the LCS
  let i = aLines.length
  let j = bLines.length
  while (i > 0 && j > 0) {
    if (aLines[i - 1] === bLines[j - 1]) {
      aMatched[i - 1] = true
      bMatched[j - 1] = true
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return {
    aStatus: aMatched.map((m) => (m ? 'matched' : 'unmatched')),
    bStatus: bMatched.map((m) => (m ? 'matched' : 'unmatched')),
  }
}

// ---------------------------------------------------------------------------
// JsonBlock — pretty-printed pre block with optional tone and diff map
// ---------------------------------------------------------------------------
function JsonBlock({
  label,
  data,
  tone,
  lineStatuses,
}: {
  label: string
  data: unknown
  tone?: 'before' | 'after'
  lineStatuses?: LineStatus[]
}) {
  const bg =
    tone === 'before'
      ? 'bg-red-50/30 dark:bg-red-950/10'
      : tone === 'after'
        ? 'bg-green-50/30 dark:bg-green-950/10'
        : 'bg-muted/30'
  const masked = useMemo(() => maskSensitive(data), [data])

  if (data === null) {
    return (
      <div className={`border rounded-sm overflow-hidden ${bg}`}>
        <div className="px-2 py-1 border-b text-xs uppercase font-semibold text-muted-foreground tracking-wide">
          {label}
        </div>
        <pre className="text-[11px] p-2 whitespace-pre font-mono overflow-auto max-h-[calc(100vh-16rem)]">
          {'—'}
        </pre>
      </div>
    )
  }

  const jsonStr = JSON.stringify(masked, null, 2)

  // When lineStatuses is provided, render per-line divs for color coding
  if (lineStatuses) {
    const lines = jsonStr.split('\n')
    return (
      <div className={`border rounded-sm overflow-hidden ${bg}`}>
        <div className="px-2 py-1 border-b text-xs uppercase font-semibold text-muted-foreground tracking-wide">
          {label}
        </div>
        <pre className="text-[11px] p-2 whitespace-pre font-mono overflow-auto max-h-[calc(100vh-16rem)]">
          {lines.map((line, idx) => {
            const status = lineStatuses[idx]
            const cls =
              status === 'unmatched' && tone === 'before'
                ? 'text-destructive'
                : status === 'unmatched' && tone === 'after'
                  ? 'text-green-600 dark:text-green-400'
                  : undefined
            return (
              <div key={idx} className={cls}>
                {line}
              </div>
            )
          })}
        </pre>
      </div>
    )
  }

  return (
    <div className={`border rounded-sm overflow-hidden ${bg}`}>
      <div className="px-2 py-1 border-b text-xs uppercase font-semibold text-muted-foreground tracking-wide">
        {label}
      </div>
      <pre className="text-[11px] p-2 whitespace-pre font-mono overflow-auto max-h-[calc(100vh-16rem)]">
        {jsonStr}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DetailSheet — public component
// ---------------------------------------------------------------------------
export function DetailSheet({ log, open, onOpenChange, configMap }: IProps) {
  const { t } = useTranslation('auditLog')

  // Compute line diff for Update events only — must be before any early return
  const updateDiff = useMemo(() => {
    if (!log || log.event !== 'Update') return null
    if (log.from === null || log.to === null) return null
    const fromStr = JSON.stringify(maskSensitive(log.from), null, 2)
    const toStr = JSON.stringify(maskSensitive(log.to), null, 2)
    const fromLines = fromStr.split('\n')
    const toLines = toStr.split('\n')
    const { aStatus, bStatus } = diffLines(fromLines, toLines)
    return { fromStatus: aStatus, toStatus: bStatus }
  }, [log])

  if (!log) return null

  const entityLabel = configMap?.get(log.entity) ?? log.entity
  const _rawId =
    (log.to as Record<string, unknown> | null)?.['slug'] ??
    (log.from as Record<string, unknown> | null)?.['slug']
  const humanReadableId = typeof _rawId === 'string' ? _rawId : null
  const actorLabel =
    log.user === 'unknown' ? t('auditLog.systemActor') : log.user

  const copyRaw = () =>
    navigator.clipboard?.writeText(
      JSON.stringify({ from: maskSensitive(log.from), to: maskSensitive(log.to) }, null, 2),
    )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col" aria-describedby="">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 mb-3">
            <AuditEventBadge event={log.event} />
            <span>
              {t(`auditLog.entityLabels.${entityLabel}`, { defaultValue: entityLabel })}
            </span>
            <span className="text-muted-foreground font-normal">
              #{humanReadableId ?? log.slug}
            </span>
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            {moment(log.createdAt).format('HH:mm DD/MM/YYYY')} · {actorLabel}
          </div>
        </SheetHeader>

        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-10rem)]">
            <div className="p-4">
              {log.event === 'Create' && (
                <JsonBlock label={t('auditLog.sheet.after')} data={log.to} />
              )}
              {log.event === 'Delete' && (
                <JsonBlock label={t('auditLog.sheet.before')} data={log.from} />
              )}
              {log.event === 'Update' && (
                <div className="grid grid-cols-2 gap-3">
                  <JsonBlock
                    label={t('auditLog.sheet.before')}
                    data={log.from}
                    tone="before"
                    lineStatuses={updateDiff?.fromStatus}
                  />
                  <JsonBlock
                    label={t('auditLog.sheet.after')}
                    data={log.to}
                    tone="after"
                    lineStatuses={updateDiff?.toStatus}
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="shrink-0 p-4 border-t">
            <Button variant="outline" size="sm" onClick={copyRaw}>
              <Copy className="h-4 w-4 mr-1" />
              {t('auditLog.sheet.copyRaw')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              {t('auditLog.sheet.close')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
