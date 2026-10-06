import { useState } from 'react'
import { useFilmPacket } from '@/hooks/useFilmPacket'
import {
  addShot, addTake, missingTakes, moveShot, packetCopyText, removeShot, removeTake, updateShot, updateTake,
} from '@/lib/filmPacket'
import type { ContentIdea } from '@/types/content'

type Props = { idea: ContentIdea; onBack: () => void }

const SYNC_LABEL = { saved: 'Saved', saving: 'Saving…', unsynced: 'Unsynced', conflict: 'Conflict' } as const

export default function FilmCard({ idea, onBack }: Props) {
  const f = useFilmPacket(idea)
  const [step, setStep] = useState(0)
  const [copy, setCopy] = useState<'ok' | 'failed' | null>(null)

  if (f.load === 'loading') return <p className="text-sm text-gray-600">Loading…</p>
  if (f.load === 'error') {
    return (
      <div role="alert" className="text-sm text-red-700">
        Could not load this packet.{' '}
        <button type="button" onClick={() => void f.reload()} className="text-accent underline">Retry</button>
      </div>
    )
  }

  const { shots, state } = f.content
  const last = shots.length                       // the final step sits after the last shot
  const idx = Math.min(step, last)
  const onFinish = idx === last
  const shot = onFinish ? null : shots[idx]
  const locked = f.sync === 'conflict'
  const missing = missingTakes(shots)
  const hook = (idea.hook_first_2s ?? idea.hook ?? '').trim()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(packetCopyText(idea, f.content))
      setCopy('ok')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-xs text-accent hover:underline">← Ideas</button>
        <span className="text-xs text-gray-600" aria-live="polite">{SYNC_LABEL[f.sync]}</span>
      </div>

      <div className="bg-card border border-border rounded-lg p-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{idea.title}</p>
        {idea.viewer_payoff && <p className="text-sm text-gray-900 mt-1">{idea.viewer_payoff}</p>}
        {hook && <p className="text-sm text-gray-600 mt-1">{hook}</p>}
      </div>

      {f.notice && <p className="text-xs text-gray-600">{f.notice}</p>}
      {f.error && (
        <p role="alert" className="text-xs text-red-700">
          {f.error}{' '}
          <button type="button" onClick={f.retry} className="underline">Retry</button>
        </p>
      )}
      {f.conflict && (
        <div role="alert" className="bg-card border border-border rounded-lg p-3 text-sm">
          <p className="text-gray-900">This packet changed elsewhere.</p>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={f.keepMine} className="text-accent underline">Keep mine</button>
            <button type="button" onClick={f.takeServer} className="text-accent underline">Use theirs</button>
          </div>
        </div>
      )}

      {shot ? (
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-3">
          <p className="text-xs text-gray-500">Shot {idx + 1} of {shots.length}</p>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Shot label
            <input
              className="border border-border rounded px-2 py-2 text-sm text-gray-900"
              value={shot.label}
              disabled={locked}
              onChange={e => f.edit(c => ({ ...c, shots: updateShot(c.shots, shot.id, { label: e.target.value }) }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={shot.filmed}
              disabled={locked}
              onChange={e => f.edit(c => ({ ...c, shots: updateShot(c.shots, shot.id, { filmed: e.target.checked }) }))}
            />
            Filmed
          </label>
          {shot.filmed && !shot.takes.some(t => t.ref.trim()) && <p className="text-xs text-red-700">Missing take</p>}

          {shot.takes.map((t, i) => (
            <div key={i} className="flex flex-col gap-1 border border-border rounded p-2">
              <input
                aria-label="Take reference"
                placeholder="Camera-roll name, link or note"
                className="border border-border rounded px-2 py-2 text-sm"
                value={t.ref}
                disabled={locked}
                onChange={e => f.edit(c => ({ ...c, shots: updateTake(c.shots, shot.id, i, { ref: e.target.value }) }))}
              />
              <input
                aria-label="Take note"
                placeholder="Note (optional)"
                className="border border-border rounded px-2 py-2 text-sm"
                value={t.note}
                disabled={locked}
                onChange={e => f.edit(c => ({ ...c, shots: updateTake(c.shots, shot.id, i, { note: e.target.value }) }))}
              />
              <button
                type="button"
                disabled={locked}
                onClick={() => f.edit(c => ({ ...c, shots: removeTake(c.shots, shot.id, i) }))}
                className="text-xs text-red-700 text-left underline disabled:opacity-40"
              >
                Remove take
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 text-xs">
            <button type="button" disabled={locked} onClick={() => f.edit(c => ({ ...c, shots: addTake(c.shots, shot.id) }))} className="text-accent underline disabled:opacity-40">Add take</button>
            <button type="button" disabled={locked || idx === 0} onClick={() => { f.edit(c => ({ ...c, shots: moveShot(c.shots, shot.id, -1) })); setStep(idx - 1) }} className="text-accent underline disabled:opacity-40">Move earlier</button>
            <button type="button" disabled={locked || idx === shots.length - 1} onClick={() => { f.edit(c => ({ ...c, shots: moveShot(c.shots, shot.id, 1) })); setStep(idx + 1) }} className="text-accent underline disabled:opacity-40">Move later</button>
            <button type="button" disabled={locked} onClick={() => f.edit(c => ({ ...c, shots: removeShot(c.shots, shot.id) }))} className="text-red-700 underline disabled:opacity-40">Remove shot</button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-3">
          <p className="text-sm text-gray-900">{shots.length} shots</p>
          <section aria-label="Missing takes">
            {missing.length === 0 ? (
              <p className="text-xs text-gray-600">No missing takes.</p>
            ) : (
              <ul className="text-xs text-red-700 list-disc pl-4">
                {missing.map(s => <li key={s.id}>{s.label}</li>)}
              </ul>
            )}
          </section>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" disabled={locked} onClick={() => f.edit(c => ({ ...c, shots: addShot(c.shots, 'New shot') }))} className="text-accent underline disabled:opacity-40">Add shot</button>
            <button
              type="button"
              disabled={locked}
              onClick={() => f.edit(c => ({ ...c, state: c.state === 'ready_to_edit' ? 'filming' : 'ready_to_edit' }))}
              className="text-accent underline disabled:opacity-40"
            >
              {state === 'ready_to_edit' ? 'Back to filming' : 'Mark ready to edit'}
            </button>
            <button type="button" onClick={() => void handleCopy()} className="text-accent underline">Copy packet</button>
          </div>
          {state === 'ready_to_edit' && missing.length > 0 && (
            <p className="text-xs text-red-700">Ready to edit, but {missing.length} shot{missing.length === 1 ? ' is' : 's are'} missing a take.</p>
          )}
          {copy === 'ok' && <span className="text-xs text-gray-600">Copied</span>}
          {copy === 'failed' && <span className="text-xs text-red-700">Copy failed</span>}
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" disabled={idx === 0} onClick={() => setStep(idx - 1)} className="px-4 py-2 text-sm border border-border rounded disabled:opacity-40">Back</button>
        {onFinish ? (
          <span />
        ) : idx === last - 1 ? (
          <button type="button" onClick={() => setStep(last)} className="px-4 py-2 text-sm bg-accent text-white rounded">Finish</button>
        ) : (
          <button type="button" onClick={() => setStep(idx + 1)} className="px-4 py-2 text-sm bg-accent text-white rounded">Next</button>
        )}
      </div>
    </div>
  )
}
