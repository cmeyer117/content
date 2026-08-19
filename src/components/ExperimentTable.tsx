import type { ExperimentRow } from '@/lib/experiments'

const dash = (v: string | number | null) => v ?? '—'

export default function ExperimentTable({ rows }: { rows: ExperimentRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-600">No ideas tagged into this experiment yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-500 uppercase tracking-wide">
            <th className="pr-3 py-1">Title</th>
            <th className="pr-3 py-1">Class</th>
            <th className="pr-3 py-1">Hook</th>
            <th className="pr-3 py-1">Length</th>
            <th className="pr-3 py-1">Views</th>
            <th className="pr-3 py-1">Likes</th>
            <th className="pr-3 py-1">Shares</th>
            <th className="pr-3 py-1">Saves</th>
            <th className="pr-3 py-1">Eng. Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="text-gray-900 border-t border-border">
              <td className="pr-3 py-1">{r.title}</td>
              <td className="pr-3 py-1">{dash(r.content_class)}</td>
              <td className="pr-3 py-1">{dash(r.hook)}</td>
              <td className="pr-3 py-1">{dash(r.target_length_seconds)}</td>
              <td className="pr-3 py-1">{dash(r.views)}</td>
              <td className="pr-3 py-1">{dash(r.likes)}</td>
              <td className="pr-3 py-1">{dash(r.shares)}</td>
              <td className="pr-3 py-1">{dash(r.saves)}</td>
              <td className="pr-3 py-1">{dash(r.metricool_engagement_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
