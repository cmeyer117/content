import { useState } from 'react'
import type { ContentIdea, Pillar, Platform, ContentClass } from '@/types/content'
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
  const [contentClass, setContentClass] = useState<ContentClass | ''>(idea.content_class ?? '')
  const [hookFirst2s, setHookFirst2s] = useState(idea.hook_first_2s ?? '')
  const [viewerPayoff, setViewerPayoff] = useState(idea.viewer_payoff ?? '')
  const [targetLength, setTargetLength] = useState(idea.target_length_seconds?.toString() ?? '')
  const [lengthJustification, setLengthJustification] = useState(idea.length_justification ?? '')
  const [diaryJustification, setDiaryJustification] = useState(idea.diary_justification ?? '')
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
        content_class: contentClass || null,
        hook_first_2s: hookFirst2s.trim() || null,
        viewer_payoff: viewerPayoff.trim() || null,
        target_length_seconds: targetLength.trim() === '' ? null : Math.round(Number(targetLength)),
        length_justification: lengthJustification.trim() || null,
        diary_justification: diaryJustification.trim() || null,
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
          <h2 className="text-lg font-bold text-gray-900">Edit Idea</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-sm"
          >
            ✕
          </button>
        </div>

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
          placeholder="Hook"
          value={hook}
          onChange={e => setHook(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full min-h-[160px]"
          placeholder="Body / script / caption"
          value={body}
          onChange={e => setBody(e.target.value)}
        />

        <textarea
          className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full min-h-[80px]"
          placeholder="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {idea.status === 'IDEA' && (
          <div className="border border-border rounded-lg p-3 flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-700">Hook-First Brief</p>

            <select
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-900"
              value={contentClass}
              onChange={e => setContentClass(e.target.value as ContentClass)}
            >
              <option value="">Content class...</option>
              <option value="technique">Technique</option>
              <option value="craft">Craft</option>
              <option value="transformation">Transformation</option>
              <option value="diary">Diary</option>
            </select>

            <input
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
              placeholder="Opening hook (first 1-2 seconds)"
              value={hookFirst2s}
              onChange={e => setHookFirst2s(e.target.value)}
            />

            <input
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
              placeholder="Viewer payoff (what they get for watching)"
              value={viewerPayoff}
              onChange={e => setViewerPayoff(e.target.value)}
            />

            <input
              type="number"
              min={1}
              className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-32"
              placeholder="Target length (s)"
              value={targetLength}
              onChange={e => setTargetLength(e.target.value)}
            />

            {Number(targetLength) > 30 && (
              <input
                className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
                placeholder="Why does this earn extra length?"
                value={lengthJustification}
                onChange={e => setLengthJustification(e.target.value)}
              />
            )}

            {contentClass === 'diary' && (
              <input
                className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-full"
                placeholder="Why does this earn diary treatment anyway?"
                value={diaryJustification}
                onChange={e => setDiaryJustification(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="flex gap-3">
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-900 flex-1"
            value={pillar}
            onChange={e => setPillar(e.target.value as Pillar)}
          >
            {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-900 flex-1"
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
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-24"
            placeholder="Idea Score (1-10)"
            value={ideaScore}
            onChange={e => setIdeaScore(e.target.value)}
          />
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm flex-1"
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
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm w-24"
            placeholder="Execution Score (1-10)"
            value={executionScore}
            onChange={e => setExecutionScore(e.target.value)}
          />
          <input
            className="bg-surface border border-border rounded-lg px-4 py-2 text-gray-900 text-sm flex-1"
            placeholder="Execution score notes"
            value={executionScoreNotes}
            onChange={e => setExecutionScoreNotes(e.target.value)}
          />
        </div>

        {idea.predicted_score != null && (
          <div className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-gray-500">
            <p className="font-medium text-gray-700">🔮 Predicted pattern-fit: {idea.predicted_score}/10</p>
            {idea.predicted_reasoning && <p className="text-xs mt-1">{idea.predicted_reasoning}</p>}
          </div>
        )}

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
