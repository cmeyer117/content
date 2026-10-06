// Film Mode pure logic. No I/O: the store, hook and components own storage, saving and rendering.
import { packetText } from '@/lib/publishPacket'
import type { ContentIdea } from '@/types/content'
import type { FilmContent, FilmDraft, FilmShot, FilmTake } from '@/types/film'

export const MAX_LABEL = 200
export const MAX_TEXT = 1000

type IdGen = () => string
const defaultId: IdGen = () => crypto.randomUUID()

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v : '').slice(0, max)
const firstLine = (s: string | null | undefined): string => (s ?? '').trim().split(/\r?\n/)[0]?.trim() ?? ''
const makeShot = (id: string, label: string): FilmShot => ({ id, label: clip(label, MAX_LABEL), filmed: false, takes: [] })

type SeedIdea = Pick<ContentIdea, 'hook' | 'hook_first_2s' | 'body' | 'viewer_payoff'>

// First open of a READY idea: three editable shots drawn from the idea. After this the packet owns the labels.
export function seedShots(idea: SeedIdea, newId: IdGen = defaultId): FilmShot[] {
  return [
    makeShot(newId(), firstLine(idea.hook_first_2s) || firstLine(idea.hook) || 'Hook'),
    makeShot(newId(), firstLine(idea.body) || 'Main demonstration'),
    makeShot(newId(), firstLine(idea.viewer_payoff) || 'Result / payoff'),
  ]
}

// Repairs anything read from the server or localStorage: never trust its shape.
export function normalizeShots(raw: unknown, newId: IdGen = defaultId): FilmShot[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: FilmShot[] = []
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue
    const o = r as Record<string, unknown>
    let id = typeof o.id === 'string' ? o.id.trim() : ''
    if (!id || seen.has(id)) id = newId()
    seen.add(id)
    const takes: FilmTake[] = Array.isArray(o.takes)
      ? o.takes
          .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
          .map(t => ({ ref: clip(t.ref, MAX_TEXT), note: clip(t.note, MAX_TEXT) }))
      : []
    out.push({ id, label: clip(o.label, MAX_LABEL), filmed: o.filmed === true, takes })
  }
  return out
}

const mapShot = (shots: FilmShot[], id: string, fn: (s: FilmShot) => FilmShot): FilmShot[] =>
  shots.map(s => (s.id === id ? fn(s) : s))

export function moveShot(shots: FilmShot[], id: string, delta: -1 | 1): FilmShot[] {
  const i = shots.findIndex(s => s.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= shots.length) return shots
  const next = [...shots]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const removeShot = (shots: FilmShot[], id: string): FilmShot[] => shots.filter(s => s.id !== id)
export const addShot = (shots: FilmShot[], label: string, id: string = defaultId()): FilmShot[] => [...shots, makeShot(id, label)]
export const updateShot = (shots: FilmShot[], id: string, patch: Partial<Pick<FilmShot, 'label' | 'filmed'>>): FilmShot[] =>
  mapShot(shots, id, s => ({ ...s, ...patch, label: patch.label === undefined ? s.label : clip(patch.label, MAX_LABEL) }))
export const addTake = (shots: FilmShot[], id: string): FilmShot[] =>
  mapShot(shots, id, s => ({ ...s, takes: [...s.takes, { ref: '', note: '' }] }))
export const updateTake = (shots: FilmShot[], id: string, index: number, patch: Partial<FilmTake>): FilmShot[] =>
  mapShot(shots, id, s => ({
    ...s,
    takes: s.takes.map((t, i) => (i === index
      ? { ref: patch.ref === undefined ? t.ref : clip(patch.ref, MAX_TEXT), note: patch.note === undefined ? t.note : clip(patch.note, MAX_TEXT) }
      : t)),
  }))
export const removeTake = (shots: FilmShot[], id: string, index: number): FilmShot[] =>
  mapShot(shots, id, s => ({ ...s, takes: s.takes.filter((_, i) => i !== index) }))

// A shot marked filmed but with no take reference: the one thing the edit step must not lose track of.
export const missingTakes = (shots: FilmShot[]): FilmShot[] =>
  shots.filter(s => s.filmed && !s.takes.some(t => t.ref.trim()))

export function filmProgress(c: FilmContent | null): string {
  if (!c) return 'not started'
  if (c.state === 'ready_to_edit') return 'ready to edit'
  if (c.shots.length === 0) return 'no shots'
  return `${c.shots.filter(s => s.filmed).length}/${c.shots.length} filmed`
}

type CopyIdea = Pick<ContentIdea, 'id' | 'title' | 'hook' | 'hook_first_2s' | 'viewer_payoff' | 'body' | 'platform' | 'pillar'>

export function packetCopyText(idea: CopyIdea, c: FilmContent): string {
  const hook = firstLine(idea.hook_first_2s) || firstLine(idea.hook)
  const missing = new Set(missingTakes(c.shots).map(s => s.id))
  const lines: string[] = [idea.title]
  if (hook) lines.push(`Hook: ${hook}`)
  if (idea.viewer_payoff?.trim()) lines.push(`Promise: ${idea.viewer_payoff.trim()}`)
  lines.push('', 'Shots')
  c.shots.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.label} [${s.filmed ? 'filmed' : 'not filmed'}]`)
    for (const t of s.takes) {
      if (t.ref.trim()) lines.push(`   - ${t.ref.trim()}${t.note.trim() ? ` (${t.note.trim()})` : ''}`)
    }
    if (missing.has(s.id)) lines.push('   - MISSING TAKE')
  })
  const caption = packetText(idea, 'caption')
  if (caption) lines.push('', 'Caption:', caption)
  return lines.join('\n')
}

export const sameContent = (a: FilmContent, b: FilmContent): boolean =>
  a.state === b.state && JSON.stringify(a.shots) === JSON.stringify(b.shots)

export type OpenResolution = { kind: 'use-server' } | { kind: 'resume' } | { kind: 'conflict' }

// Ordering is by server version, never by timestamps. A draft identical to the server is just stale bookkeeping.
export function resolveOpen(server: FilmContent & { version: number }, draft: FilmDraft | null): OpenResolution {
  if (!draft || sameContent(server, draft)) return { kind: 'use-server' }
  return draft.baseVersion === server.version ? { kind: 'resume' } : { kind: 'conflict' }
}
