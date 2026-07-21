import { useState } from 'react'
import type { ContentIdea, Pillar, Platform } from '@/types/content'
import { PILLARS, PLATFORMS } from '@/lib/constants'

type Props = {
  idea: ContentIdea
  onClose: () => void
  onSave: (id: string, changes: Partial<ContentIdea>) => Promise<void>
}

function clampScore(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Math.round(Number(raw))
  if (Number.isNaN(n)) return null
  return Math.min(10, Math.max(1, n))
}

export default function IdeaDetailModal({ idea, onClose, onSave }: Props) {
  const [title, setTitle] = useState(idea.title)
  const [hook, setHook] = useState(idea.hook ?? '')
  const [body, setBody] = useState(idea.body ?? '')
  const [notes, setNotes] = useState(idea.notes ?? '')
  const [pillar, setPillar] = useState<Pillar>(idea.pillar)
  const [platform, setPlatform] = useState<Platform>(idea.platform)
  const [ideaScore, setIdeaScore] = useState(idea.idea_score?.toString() ?? '')
  const [ideaScoreNotes, setIdeaScoreNotes] = useState(idea.idea_score_notes ?? '')
  const [executionScore, setExecutionScore] = useState(idea.execution_score?.toString() ?? '')
  const [executionScoreNotes, setExecutionScoreNotes] = useState(idea.execution_score_notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(idea.id, {
        title,
        hook: hook || null,
        body: body || null,
        notes: notes || null,
        pillar,
        platform,
        idea_score: clampScore(ideaScore),
        idea_score_notes: ideaScoreNotes || null,
        execution_score: clampScore(executionScore),
        execution_score_notes: executionScoreNotes || null,
      })
      onClose()
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
        className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Edit Idea</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full"
          placeholder="Hook"
          value={hook}
          onChange={e => setHook(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full min-h-[160px]"
          placeholder="Body / script / caption"
          value={body}
          onChange={e => setBody(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-full min-h-[80px]"
          placeholder="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className="flex gap-3">
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={pillar}
            onChange={e => setPillar(e.target.value as Pillar)}
          >
            {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={platform}
            onChange={e => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-24"
            placeholder="Idea Score (1-10)"
            value={ideaScore}
            onChange={e => setIdeaScore(e.target.value)}
          />
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm flex-1"
            placeholder="Idea score notes"
            value={ideaScoreNotes}
            onChange={e => setIdeaScoreNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm w-24"
            placeholder="Execution Score (1-10)"
            value={executionScore}
            onChange={e => setExecutionScore(e.target.value)}
          />
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white text-sm flex-1"
            placeholder="Execution score notes"
            value={executionScoreNotes}
            onChange={e => setExecutionScoreNotes(e.target.value)}
          />
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
