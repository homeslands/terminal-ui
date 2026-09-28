import { NotepadText } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function StaffOrderNoteInput({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded border border-pos-border bg-pos-card">
      <NotepadText size={14} className="mt-1 shrink-0 text-pos-faint" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Ghi chú cho cả đơn (vd: khách dị ứng tôm)..."
        rows={2}
        className="flex-1 resize-none bg-transparent text-xs text-pos-text placeholder:text-pos-faint focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}
