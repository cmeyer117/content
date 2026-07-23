type Props = { label: string; count: number; max: number; color: string }

export default function BarRow({ label, count, max, color }: Props) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 shrink-0 text-gray-400 truncate">{label}</span>
      <div className="flex-1 bg-border rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
    </div>
  )
}
