import type { PillarStageBreakdown as Breakdown } from '@/lib/chartData'
import { PIPELINE_STAGES, PIPELINE_STAGE_COLORS } from '@/lib/constants'

export default function PillarStageBreakdown({ data }: { data: Breakdown[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map(row => {
        const total = PIPELINE_STAGES.reduce((sum, s) => sum + row[s], 0)
        return (
          <div key={row.pillar} className="flex items-center gap-3">
            <span className="text-xs w-28 shrink-0 text-gray-500 truncate">{row.label}</span>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-border flex">
              {PIPELINE_STAGES.filter(s => row[s] > 0).map(s => (
                <div
                  key={s}
                  style={{ width: `${(row[s] / (total || 1)) * 100}%`, backgroundColor: PIPELINE_STAGE_COLORS[s] }}
                  title={`${s}: ${row[s]}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{total}</span>
          </div>
        )
      })}
    </div>
  )
}
