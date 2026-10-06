// Film Mode I/O: the only file that talks to Supabase or localStorage for film packets.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { normalizeShots, sameContent } from '@/lib/filmPacket'
import type { FilmContent, FilmDraft, FilmPacket, FilmShot } from '@/types/film'

export type Db = Pick<SupabaseClient, 'from'>

const COLS = 'id, content_idea_id, shots, state, version'
const MAX_DRAFT_CHARS = 300_000

function toPacket(row: Record<string, unknown>): FilmPacket {
  return {
    id: String(row.id),
    content_idea_id: String(row.content_idea_id),
    shots: normalizeShots(row.shots),
    state: row.state === 'ready_to_edit' ? 'ready_to_edit' : 'filming',
    version: Number(row.version),
  }
}

export async function getPacket(ideaId: string, db: Db = supabase): Promise<FilmPacket | null> {
  const { data, error } = await db.from('film_packets').select(COLS).eq('content_idea_id', ideaId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toPacket(data as Record<string, unknown>) : null
}

export async function listPackets(db: Db = supabase): Promise<FilmPacket[]> {
  const { data, error } = await db.from('film_packets').select(COLS)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(toPacket)
}

// Insert-once: ON CONFLICT DO NOTHING, then read back. Never replaces an existing packet, so two tabs
// seeding at once cannot overwrite each other's work.
export async function createPacket(ideaId: string, shots: FilmShot[], db: Db = supabase): Promise<FilmPacket> {
  const { error } = await db.from('film_packets').upsert(
    { content_idea_id: ideaId, shots },
    { onConflict: 'content_idea_id', ignoreDuplicates: true },
  )
  if (error) throw new Error(error.message)
  const packet = await getPacket(ideaId, db)
  if (!packet) throw new Error('Film packet missing after create')
  return packet
}

export type SaveResult = { ok: true; packet: FilmPacket } | { ok: false; packet: FilmPacket }

// Conditional update: only succeeds if nobody saved since `baseVersion`. ok:false carries the current server row.
export async function savePacket(ideaId: string, baseVersion: number, content: FilmContent, db: Db = supabase): Promise<SaveResult> {
  const { data, error } = await db.from('film_packets')
    .update({ shots: content.shots, state: content.state })
    .eq('content_idea_id', ideaId)
    .eq('version', baseVersion)
    .select(COLS)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, unknown>[]
  if (rows.length === 1) return { ok: true, packet: toPacket(rows[0]) }
  const current = await getPacket(ideaId, db)
  if (!current) throw new Error('Film packet no longer exists')
  // Lost response: our own earlier save landed, the retry carried a stale base. Same content means done.
  if (sameContent(current, content)) return { ok: true, packet: current }
  return { ok: false, packet: current }
}

const draftKey = (ideaId: string) => `film-draft:${ideaId}`

// Every storage access is guarded: storage can be full, blocked or absent and must never break the screen.
export function readDraft(ideaId: string): FilmDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(ideaId))
    if (!raw || raw.length > MAX_DRAFT_CHARS) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o.baseVersion !== 'number') return null
    return { baseVersion: o.baseVersion, shots: normalizeShots(o.shots), state: o.state === 'ready_to_edit' ? 'ready_to_edit' : 'filming' }
  } catch {
    return null
  }
}

export function writeDraft(ideaId: string, draft: FilmDraft): void {
  try { localStorage.setItem(draftKey(ideaId), JSON.stringify(draft)) } catch { /* storage unavailable: the server save still runs */ }
}

export function clearDraft(ideaId: string): void {
  try { localStorage.removeItem(draftKey(ideaId)) } catch { /* nothing to clear */ }
}
