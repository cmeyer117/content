import { describe, it, expect } from 'vitest'
import {
  seedShots, normalizeShots, moveShot, removeShot, addShot, updateShot, addTake, updateTake, removeTake,
  missingTakes, filmProgress, packetCopyText, sameContent, resolveOpen, MAX_LABEL, MAX_TEXT,
} from '@/lib/filmPacket'
import type { FilmDraft, FilmPacket, FilmShot } from '@/types/film'

let n = 0
const id = () => `id-${++n}`
const shot = (i: string, filmed = false, refs: string[] = []): FilmShot => ({
  id: i, label: i, filmed, takes: refs.map(ref => ({ ref, note: '' })),
})
const packet = (shots: FilmShot[], version = 1, state: FilmPacket['state'] = 'filming'): FilmPacket => ({
  id: 'p1', content_idea_id: 'i1', shots, state, version,
})

describe('seedShots', () => {
  it('seeds Hook, Demo, Payoff from the idea', () => {
    const shots = seedShots({ hook: 'old hook', hook_first_2s: 'Stop doing this', body: 'Show the setup\nthen the set', viewer_payoff: 'Clean reps' }, id)
    expect(shots.map(s => s.label)).toEqual(['Stop doing this', 'Show the setup', 'Clean reps'])
    expect(shots.every(s => !s.filmed && s.takes.length === 0)).toBe(true)
    expect(new Set(shots.map(s => s.id)).size).toBe(3)
  })

  it('falls back when idea fields are missing', () => {
    const shots = seedShots({ hook: null, hook_first_2s: null, body: null, viewer_payoff: null }, id)
    expect(shots.map(s => s.label)).toEqual(['Hook', 'Main demonstration', 'Result / payoff'])
  })

  it('uses hook when hook_first_2s is empty', () => {
    const shots = seedShots({ hook: 'Fallback hook', hook_first_2s: '  ', body: null, viewer_payoff: null }, id)
    expect(shots[0].label).toBe('Fallback hook')
  })
})

describe('normalizeShots', () => {
  it('returns [] for non-arrays', () => {
    expect(normalizeShots(null)).toEqual([])
    expect(normalizeShots({ a: 1 })).toEqual([])
    expect(normalizeShots('x')).toEqual([])
  })

  it('drops non-objects, regenerates empty and duplicate ids, clips long text, coerces filmed', () => {
    const out = normalizeShots([
      7,
      null,
      { id: 'a', label: 'x'.repeat(MAX_LABEL + 50), filmed: 'yes', takes: [{ ref: 'r'.repeat(MAX_TEXT + 5), note: 3 }, 'bad'] },
      { id: 'a', label: 'dup' },
      { id: '   ', label: 'blank id', filmed: true },
    ], id)
    expect(out).toHaveLength(3)
    expect(out[0].label).toHaveLength(MAX_LABEL)
    expect(out[0].filmed).toBe(false)
    expect(out[0].takes).toEqual([{ ref: 'r'.repeat(MAX_TEXT), note: '' }])
    expect(new Set(out.map(s => s.id)).size).toBe(3)
    expect(out[2].filmed).toBe(true)
  })
})

describe('mutations', () => {
  const base = [shot('a'), shot('b'), shot('c')]

  it('moveShot swaps neighbours and ignores out-of-range moves', () => {
    expect(moveShot(base, 'b', -1).map(s => s.id)).toEqual(['b', 'a', 'c'])
    expect(moveShot(base, 'b', 1).map(s => s.id)).toEqual(['a', 'c', 'b'])
    expect(moveShot(base, 'a', -1)).toBe(base)
    expect(moveShot(base, 'c', 1)).toBe(base)
    expect(moveShot(base, 'zzz', 1)).toBe(base)
  })

  it('removeShot, addShot', () => {
    expect(removeShot(base, 'b').map(s => s.id)).toEqual(['a', 'c'])
    const added = addShot(base, 'Extra', 'new-id')
    expect(added).toHaveLength(4)
    expect(added[3]).toEqual({ id: 'new-id', label: 'Extra', filmed: false, takes: [] })
  })

  it('updateShot patches one shot only', () => {
    const out = updateShot(base, 'b', { filmed: true, label: 'B2' })
    expect(out[1]).toMatchObject({ id: 'b', filmed: true, label: 'B2' })
    expect(out[0]).toBe(base[0])
  })

  it('addTake, updateTake, removeTake', () => {
    let s = addTake(base, 'a')
    expect(s[0].takes).toEqual([{ ref: '', note: '' }])
    s = updateTake(s, 'a', 0, { ref: 'IMG_1.mov' })
    expect(s[0].takes[0].ref).toBe('IMG_1.mov')
    s = removeTake(s, 'a', 0)
    expect(s[0].takes).toEqual([])
  })
})

describe('missingTakes and filmProgress', () => {
  it('flags filmed shots with no non-empty take ref', () => {
    const shots = [shot('a', true, ['ref']), shot('b', true, ['  ']), shot('c', true), shot('d', false)]
    expect(missingTakes(shots).map(s => s.id)).toEqual(['b', 'c'])
  })

  it('progress covers not started, none, counts, ready', () => {
    expect(filmProgress(null)).toBe('not started')
    expect(filmProgress(packet([]))).toBe('no shots')
    expect(filmProgress(packet([shot('a', true), shot('b'), shot('c')]))).toBe('1/3 filmed')
    expect(filmProgress(packet([shot('a', true), shot('b', true), shot('c', true), shot('d')]))).toBe('3/4 filmed')
    expect(filmProgress(packet([shot('a')], 1, 'ready_to_edit'))).toBe('ready to edit')
  })
})

describe('packetCopyText', () => {
  const idea = { id: 'i1', title: 'Deadlift setup', hook: null, hook_first_2s: 'Stop rounding', viewer_payoff: 'Stronger pull', body: 'My caption', platform: 'both' as const, pillar: 'training' as const }

  it('includes title, hook, promise, shots with takes, missing-take lines and caption', () => {
    const text = packetCopyText(idea, packet([
      { id: 'a', label: 'Hook shot', filmed: true, takes: [{ ref: 'IMG_1.mov', note: 'best one' }] },
      { id: 'b', label: 'Demo', filmed: true, takes: [] },
      { id: 'c', label: 'Payoff', filmed: false, takes: [] },
    ]))
    expect(text).toContain('Deadlift setup')
    expect(text).toContain('Hook: Stop rounding')
    expect(text).toContain('Promise: Stronger pull')
    expect(text).toContain('1. Hook shot [filmed]')
    expect(text).toContain('IMG_1.mov (best one)')
    expect(text).toContain('2. Demo [filmed]')
    expect(text).toContain('MISSING TAKE')
    expect(text).toContain('3. Payoff [not filmed]')
    expect(text).toContain('Caption:\nMy caption')
  })

  it('omits the caption block when there is no caption', () => {
    expect(packetCopyText({ ...idea, body: null }, packet([]))).not.toContain('Caption:')
  })
})

describe('resolveOpen', () => {
  const server = packet([shot('a')], 3)
  const draft = (over: Partial<FilmDraft>): FilmDraft => ({ baseVersion: 3, shots: [shot('a', true)], state: 'filming', ...over })

  it('use-server when there is no draft', () => {
    expect(resolveOpen(server, null)).toEqual({ kind: 'use-server' })
  })
  it('use-server when the draft equals the server content (any base)', () => {
    expect(resolveOpen(server, draft({ shots: [shot('a')] }))).toEqual({ kind: 'use-server' })
    expect(resolveOpen(server, draft({ shots: [shot('a')], baseVersion: 1 }))).toEqual({ kind: 'use-server' })
  })
  it('resume when the draft differs and its base is the server version', () => {
    expect(resolveOpen(server, draft({}))).toEqual({ kind: 'resume' })
  })
  it('conflict when the draft differs and its base is older', () => {
    expect(resolveOpen(server, draft({ baseVersion: 2 }))).toEqual({ kind: 'conflict' })
  })
  it('conflict when the draft base is newer than the server (rolled-back row)', () => {
    expect(resolveOpen(server, draft({ baseVersion: 9 }))).toEqual({ kind: 'conflict' })
  })
  it('sameContent compares shots and state', () => {
    expect(sameContent(packet([shot('a')]), { shots: [shot('a')], state: 'filming' })).toBe(true)
    expect(sameContent(packet([shot('a')]), { shots: [shot('a')], state: 'ready_to_edit' })).toBe(false)
  })
})
