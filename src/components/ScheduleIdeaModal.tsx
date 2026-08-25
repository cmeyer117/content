import { useState } from 'react'
import type { ContentIdea } from '@/types/content'
import { isoToPublishInput } from '@/lib/publishQueue'

type Props = {
  idea: ContentIdea
  onClose: () => void
  onSchedule: (id: string, publishInput: string) => Promise<void>
}

export default function ScheduleIdeaModal({ idea, onClose, onSchedule }: Props) {
  const [value, setValue] = useState(isoToPublishInput(idea.publish_at))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!value) {
      setError('Enter a publish time.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSchedule(idea.id, value)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Schedule "{idea.title}"</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-sm"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Publish time (Eastern)
          <input
            type="datetime-local"
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Scheduling...' : 'Schedule'}
        </button>
      </div>
    </div>
  )
}
