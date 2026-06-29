import type { PipelineStatus } from '@/types/content'

const colors: Record<PipelineStatus, string> = {
  IDEA: 'bg-gray-800 text-gray-300',
  DRAFT: 'bg-yellow-900 text-yellow-200',
  READY: 'bg-blue-900 text-blue-200',
  SCHEDULED: 'bg-indigo-900 text-indigo-200',
  POSTED: 'bg-green-900 text-green-200',
  TRACKED: 'bg-emerald-900 text-emerald-200',
}

export default function StatusBadge({ status }: { status: PipelineStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status]}`}>
      {status}
    </span>
  )
}
