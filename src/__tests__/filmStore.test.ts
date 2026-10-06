import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getPacket, listPackets, createPacket, savePacket, readDraft, writeDraft, clearDraft, type Db } from '@/lib/filmStore'
import type { FilmContent } from '@/types/film'

// The store's default client is the real one, which needs env vars; every test injects a fake db instead.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

type Res = { data: unknown; error: { message: string } | null }
type Op = 'select' | 'maybeSingle' | 'update' | 'upsert'
type Script = Partial<Record<Op, Res[]>>
interface Builder {
  select(): Builder
  eq(): Builder
  update(arg: unknown): Builder
  upsert(arg: unknown, opts?: unknown): Builder
  maybeSingle(): Promise<Res>
  then(f: (v: Res) => unknown, r?: (e: unknown) => unknown): Promise<unknown>
}

function fakeDb(script: Script) {
  const log: Array<{ op: string; arg?: unknown; opts?: unknown }> = []
  const next = (op: Op): Promise<Res> => {
    const r = script[op]?.shift()
    if (!r) throw new Error(`unscripted ${op}`)
    return Promise.resolve(r)
  }
  const make = (): Builder => {
    let op: Op = 'select'
    const b: Builder = {
      select: () => b,
      eq: () => b,
      update: arg => { op = 'update'; log.push({ op, arg }); return b },
      upsert: (arg, opts) => { op = 'upsert'; log.push({ op, arg, opts }); return b },
      maybeSingle: () => next('maybeSingle'),
      then: (f, r) => next(op).then(f, r),
    }
    return b
  }
  return { db: { from: () => make() } as unknown as Db, log }
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', content_idea_id: 'i1', state: 'filming', version: 1,
  shots: [{ id: 'a', label: 'Hook', filmed: false, takes: [] }], ...over,
})
const content: FilmContent = { shots: [{ id: 'a', label: 'Hook', filmed: true, takes: [{ ref: 'IMG_1', note: '' }] }], state: 'filming' }

describe('getPacket / listPackets', () => {
  it('returns null when there is no row and normalizes the row otherwise', async () => {
    expect(await getPacket('i1', fakeDb({ maybeSingle: [{ data: null, error: null }] }).db)).toBeNull()
    const p = await getPacket('i1', fakeDb({ maybeSingle: [{ data: row({ state: 'weird', shots: 'junk' }), error: null }] }).db)
    expect(p).toMatchObject({ id: 'p1', state: 'filming', version: 1, shots: [] })
  })
  it('throws on a Supabase error', async () => {
    await expect(getPacket('i1', fakeDb({ maybeSingle: [{ data: null, error: { message: 'boom' } }] }).db)).rejects.toThrow('boom')
  })
  it('lists packets', async () => {
    const out = await listPackets(fakeDb({ select: [{ data: [row(), row({ id: 'p2', content_idea_id: 'i2' })], error: null }] }).db)
    expect(out.map(p => p.content_idea_id)).toEqual(['i1', 'i2'])
  })
})

describe('createPacket (insert-once)', () => {
  it('upserts with ignoreDuplicates and returns the stored row, so a second seed never replaces an existing packet', async () => {
    const { db, log } = fakeDb({
      upsert: [{ data: null, error: null }, { data: null, error: null }],
      maybeSingle: [{ data: row(), error: null }, { data: row(), error: null }],
    })
    const first = await createPacket('i1', [], db)
    const second = await createPacket('i1', [], db)
    expect(first.id).toBe('p1')
    expect(second.id).toBe('p1')
    expect(log.filter(l => l.op === 'upsert').every(l => JSON.stringify(l.opts) === JSON.stringify({ onConflict: 'content_idea_id', ignoreDuplicates: true }))).toBe(true)
  })
})

describe('savePacket (conditional update by version)', () => {
  it('returns ok with the new row when exactly one row matched the base version', async () => {
    const { db, log } = fakeDb({ update: [{ data: [row({ version: 2 })], error: null }] })
    const res = await savePacket('i1', 1, content, db)
    expect(res.ok).toBe(true)
    expect(res.packet.version).toBe(2)
    expect(log[0].arg).toEqual({ shots: content.shots, state: 'filming' })
  })

  it('reports a conflict (ok:false) with the current server row when the version moved on', async () => {
    const { db } = fakeDb({
      update: [{ data: [], error: null }],
      maybeSingle: [{ data: row({ version: 5, shots: [] }), error: null }],
    })
    const res = await savePacket('i1', 1, content, db)
    expect(res.ok).toBe(false)
    expect(res.packet.version).toBe(5)
  })

  it('treats a lost response as success: stale base but the server already holds exactly this content', async () => {
    const { db } = fakeDb({
      update: [{ data: [], error: null }],
      maybeSingle: [{ data: row({ version: 2, shots: content.shots }), error: null }],
    })
    const res = await savePacket('i1', 1, content, db)
    expect(res.ok).toBe(true)
    expect(res.packet.version).toBe(2)
  })

  it('throws on a Supabase error', async () => {
    await expect(savePacket('i1', 1, content, fakeDb({ update: [{ data: null, error: { message: 'offline' } }] }).db)).rejects.toThrow('offline')
  })
})

describe('draft storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips and clears', () => {
    writeDraft('i1', { baseVersion: 3, ...content })
    expect(readDraft('i1')).toEqual({ baseVersion: 3, ...content })
    clearDraft('i1')
    expect(readDraft('i1')).toBeNull()
  })
  it('discards corrupt, wrong-shape and oversized drafts', () => {
    localStorage.setItem('film-draft:i1', '{not json')
    expect(readDraft('i1')).toBeNull()
    localStorage.setItem('film-draft:i1', JSON.stringify({ shots: [] }))
    expect(readDraft('i1')).toBeNull()
    localStorage.setItem('film-draft:i1', JSON.stringify({ baseVersion: 1, shots: [], pad: 'x'.repeat(400_000) }))
    expect(readDraft('i1')).toBeNull()
  })
  it('never throws when storage is unavailable', () => {
    const real = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota') }
    expect(() => writeDraft('i1', { baseVersion: 1, ...content })).not.toThrow()
    Storage.prototype.setItem = real
  })
})
