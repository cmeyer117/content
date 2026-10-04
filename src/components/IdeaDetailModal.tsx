import { useEffect, useState } from 'react'
import type { ContentIdea, Pillar, Platform, ContentClass, Experiment } from '@/types/content'
import { PILLARS, PLATFORMS } from '@/lib/constants'
import { buildCoachingLink } from '@/lib/attribution'
import { packetText, packetMissing, packetStatus, type PacketCopyKind } from '@/lib/publishPacket'
import { saveDraft, loadDraft, clearDraft, draftDiffersFrom } from '@/lib/ideaDraft'

type Props = {
  idea: ContentIdea
  onClose: () => void
  onSave: (id: string, changes: Partial<ContentIdea>) => Promise<void>
  activeExperiment?: Experiment | null
  // Marks the idea posted exactly as the Publish Queue does (also creates the per-platform performance rows).
  onMarkPosted?: (id: string) => Promise<void>
}

const PACKET_STATUSES = ['READY', 'SCHEDULED', 'POSTED', 'TRACKED']
const publishedFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function clampScore(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Math.round(Number(raw))
  if (Number.isNaN(n)) return null
  return Math.min(10, Math.max(1, n))
}

export default function IdeaDetailModal({ idea, onClose, onSave, activeExperiment = null, onMarkPosted }: Props) {
  // Unsaved edits from a previous open (per-device convenience): restore them, with a way to discard.
  const [initialDraft] = useState(() => {
    const d = loadDraft(idea.id)
    return d && draftDiffersFrom(d, idea) ? d : null
  })
  const [restored, setRestored] = useState(initialDraft !== null)
  const [title, setTitle] = useState(initialDraft?.title ?? idea.title)
  const [hook, setHook] = useState(initialDraft?.hook ?? idea.hook ?? '')
  const [contentClass, setContentClass] = useState<ContentClass | ''>(idea.content_class ?? '')
  const [hookFirst2s, setHookFirst2s] = useState(idea.hook_first_2s ?? '')
  const [viewerPayoff, setViewerPayoff] = useState(idea.viewer_payoff ?? '')
  const [targetLength, setTargetLength] = useState(idea.target_length_seconds?.toString() ?? '')
  const [lengthJustification, setLengthJustification] = useState(idea.length_justification ?? '')
  const [diaryJustification, setDiaryJustification] = useState(idea.diary_justification ?? '')
  const [body, setBody] = useState(initialDraft?.body ?? idea.body ?? '')
  const [notes, setNotes] = useState(initialDraft?.notes ?? idea.notes ?? '')
  const [pillar, setPillar] = useState<Pillar>(idea.pillar)
  const [platform, setPlatform] = useState<Platform>(idea.platform)
  const [ideaScore, setIdeaScore] = useState(idea.idea_score?.toString() ?? '')
  const [ideaScoreNotes, setIdeaScoreNotes] = useState(idea.idea_score_notes ?? '')
  const [executionScore, setExecutionScore] = useState(idea.execution_score?.toString() ?? '')
  const [executionScoreNotes, setExecutionScoreNotes] = useState(idea.execution_score_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [experimentTagged, setExperimentTagged] = useState(idea.experiment_id === activeExperiment?.id && activeExperiment !== null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saveFailed, setSaveFailed] = useState(false)
  const [packetCopy, setPacketCopy] = useState<PacketCopyKind | 'failed' | null>(null)
  const [markState, setMarkState] = useState<'idle' | 'marking' | 'failed' | 'done'>('idle')

  useEffect(() => {
    const draft = { title, hook, body, notes }
    if (draftDiffersFrom(draft, idea)) saveDraft(idea.id, draft)
    else clearDraft(idea.id)
  }, [title, hook, body, notes, idea])

  const discardDraft = () => {
    setTitle(idea.title)
    setHook(idea.hook ?? '')
    setBody(idea.body ?? '')
    setNotes(idea.notes ?? '')
    clearDraft(idea.id)
    setRestored(false)
  }

  // The packet is built from the SAVED idea (same rule as the coaching link), so what is copied matches the DB.
  const handlePacketCopy = async (kind: PacketCopyKind) => {
    try {
      await navigator.clipboard.writeText(packetText(idea, kind))
      setPacketCopy(kind)
    } catch {
      setPacketCopy('failed')
    }
  }

  const handleMarkPublished = async () => {
    if (!onMarkPosted) return
    setMarkState('marking')
    try {
      await onMarkPosted(idea.id)
      setMarkState('done')
    } catch {
      setMarkState('failed')
    }
  }

  // Attributed coaching-landing link: the saved pillar/platform, not the
  // unsaved selects, so the copied link always matches what's in the DB.
  // No details.attributed_link_copied_at stamp -- content_ideas has no
  // details column, and this task is no-schema-change.
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildCoachingLink(idea))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveFailed(false)
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
        experiment_id: activeExperiment
          ? (experimentTagged ? activeExperiment.id : (idea.experiment_id === activeExperiment.id ? null : idea.experiment_id))
          : idea.experiment_id,
      })
      clearDraft(idea.id)
      onClose()
    } catch {
      setSaveFailed(true) // the modal stays open with the edits intact (and a local draft)
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

        {restored && (
          <p className="text-xs text-gray-600">
            Restored unsaved edits from last time.{' '}
            <button type="button" onClick={discardDraft} className="text-accent hover:underline">Discard</button>
          </p>
        )}

        {PACKET_STATUSES.includes(idea.status) && (() => {
          const status = packetStatus(idea as ContentIdea & { inquiry_count?: number | null })
          const missing = packetMissing(idea)
          const published = status.stage === 'published' || markState === 'done'
          const captionDirty = body !== (idea.body ?? '')
          return (
            <div className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-700">Publish packet</p>
              <p className="text-xs text-gray-600">
                {published
                  ? `Published${status.publishedAt ? ' ' + publishedFormatter.format(new Date(status.publishedAt)) : markState === 'done' ? ' just now' : ''}`
                  : 'Ready to post'}
                {status.inquiries ? ` · ${status.inquiries}` : ''}
                {' · '}{idea.platform}
              </p>
              {idea.hook && <p className="text-xs text-gray-700">Hook: {idea.hook}</p>}
              {missing.includes('caption')
                ? <p className="text-xs text-red-700">Add a caption before posting.</p>
                : <p className="text-sm text-gray-900 whitespace-pre-wrap">{(idea.body ?? '').trim()}</p>}
              {captionDirty && <p className="text-xs text-gray-600">Unsaved caption edits are not in the packet. Save to include them.</p>}
              {idea.notes && <p className="text-xs text-gray-600 whitespace-pre-wrap">Notes (media location, etc.): {idea.notes}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={missing.includes('caption')} onClick={() => void handlePacketCopy('caption')} className="text-xs text-accent hover:underline disabled:opacity-40">Copy caption</button>
                <button type="button" onClick={() => void handlePacketCopy('link')} className="text-xs text-accent hover:underline">Copy link</button>
                <button type="button" disabled={missing.includes('caption')} onClick={() => void handlePacketCopy('both')} className="text-xs text-accent hover:underline disabled:opacity-40">Copy caption + link</button>
                {packetCopy && packetCopy !== 'failed' && <span className="text-xs text-gray-500">Copied</span>}
                {packetCopy === 'failed' && <span className="text-xs text-red-400">Copy failed</span>}
              </div>
              {!published && onMarkPosted && (
                <div className="flex items-center gap-3">
                  <button type="button" disabled={markState === 'marking'} onClick={() => void handleMarkPublished()} className="text-xs text-green-700 hover:underline disabled:opacity-40">
                    {markState === 'marking' ? 'Marking...' : 'Mark published'}
                  </button>
                  {markState === 'failed' && <span className="text-xs text-red-700">Failed, retry</span>}
                </div>
              )}
            </div>
          )
        })()}

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

        {(idea.status === 'IDEA' || idea.status === 'DRAFT') && (
          <div className="border border-border rounded-lg p-3 flex flex-col gap-3">
            {/* Editable through IDEA and DRAFT -- the gate itself now enforces
                at the DRAFT -> READY transition (IdeaCard.tsx), so a draft can
                still evolve its hook fields before the gate matters. Fixed
                2026-08-19: previously only editable in IDEA, but the gate
                didn't check anything until READY was 2 stages later. */}
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="text-xs text-accent hover:underline text-left"
          >
            Copy coaching link
          </button>
          {copyState === 'copied' && <span className="text-xs text-gray-500">Copied</span>}
          {copyState === 'failed' && <span className="text-xs text-red-400">Copy failed</span>}
        </div>

        {activeExperiment && (
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={experimentTagged}
              onChange={e => setExperimentTagged(e.target.checked)}
            />
            Part of experiment: {activeExperiment.hypothesis}
          </label>
        )}

        {saveFailed && <p className="text-xs text-red-700">Save failed. Your edits are still here; try again.</p>}

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
