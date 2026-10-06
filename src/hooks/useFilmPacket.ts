// Load / resume / save / conflict state machine for one film packet.
// Ordering is by server `version`. One save in flight at a time; edits made meanwhile coalesce into the next save.
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, createPacket, getPacket, readDraft, savePacket, writeDraft } from '@/lib/filmStore'
import { resolveOpen, seedShots } from '@/lib/filmPacket'
import type { ContentIdea } from '@/types/content'
import type { FilmContent, FilmPacket } from '@/types/film'

export type SyncState = 'saved' | 'saving' | 'unsynced' | 'conflict'
type SeedIdea = Pick<ContentIdea, 'id' | 'hook' | 'hook_first_2s' | 'body' | 'viewer_payoff'>

const EMPTY: FilmContent = { shots: [], state: 'filming' }

export function useFilmPacket(idea: SeedIdea) {
  const ideaId = idea.id
  const ideaRef = useRef(idea)
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<FilmContent>(EMPTY)
  const [sync, setSync] = useState<SyncState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<FilmPacket | null>(null)

  const base = useRef(0)            // server version our edits are based on
  const latest = useRef<FilmContent>(EMPTY)
  const dirty = useRef(false)
  const running = useRef(false)
  const blocked = useRef(false)     // true while a conflict is unresolved

  useEffect(() => { ideaRef.current = idea }, [idea])

  const adopt = useCallback((p: FilmPacket) => {
    base.current = p.version
    latest.current = { shots: p.shots, state: p.state }
    setContent(latest.current)
  }, [])

  const flush = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (dirty.current && !blocked.current) {
        const sent = latest.current
        dirty.current = false
        setSync('saving')
        try {
          const res = await savePacket(ideaId, base.current, sent)
          if (!res.ok) {
            blocked.current = true
            setConflict(res.packet)
            setSync('conflict')
            return
          }
          base.current = res.packet.version
          if (latest.current === sent) {
            clearDraft(ideaId)   // cleared only now, after the server confirmed
            setSync('saved')
            setError(null)
          } else {
            writeDraft(ideaId, { baseVersion: base.current, ...latest.current })
          }
        } catch {
          dirty.current = true
          setSync('unsynced')
          setError('Save failed. Your edits are kept on this device.')
          return
        }
      }
    } finally {
      running.current = false
    }
  }, [ideaId])

  const open = useCallback(async () => {
    setLoad('loading')
    try {
      let server = await getPacket(ideaId)
      if (!server) server = await createPacket(ideaId, seedShots(ideaRef.current))
      const draft = readDraft(ideaId)
      const res = resolveOpen(server, draft)
      blocked.current = false
      dirty.current = false
      setConflict(null)
      setError(null)
      setNotice(null)
      if (res.kind === 'use-server' || !draft) {
        if (draft) clearDraft(ideaId)
        adopt(server)
        setSync('saved')
      } else if (res.kind === 'resume') {
        base.current = server.version
        latest.current = { shots: draft.shots, state: draft.state }
        setContent(latest.current)
        dirty.current = true
        setSync('unsynced')
        setNotice('Restored unsynced edits from this device.')
      } else {
        base.current = server.version
        latest.current = { shots: draft.shots, state: draft.state }
        setContent(latest.current)
        blocked.current = true
        setConflict(server)
        setSync('conflict')
      }
      setLoad('ready')
    } catch {
      setLoad('error')
    }
  }, [ideaId, adopt])

  useEffect(() => { void open() }, [open])

  // Resumed unsynced edits should save as soon as the screen is ready.
  useEffect(() => { if (load === 'ready' && dirty.current && !blocked.current) void flush() }, [load, flush])

  // Coming back to the tab: pick up edits made elsewhere, unless this device has unsaved edits of its own.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || dirty.current || running.current || blocked.current) return
      try {
        const s = await getPacket(ideaId)
        if (s && s.version !== base.current && !dirty.current && !running.current) {
          adopt(s)
          setNotice('Updated from another device.')
        }
      } catch { /* a failed refresh changes nothing */ }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [ideaId, adopt])

  const edit = useCallback((change: (c: FilmContent) => FilmContent) => {
    if (blocked.current) return
    const next = change(latest.current)
    latest.current = next
    setContent(next)
    writeDraft(ideaId, { baseVersion: base.current, ...next })   // draft first, then the server
    dirty.current = true
    setSync('unsynced')
    void flush()
  }, [ideaId, flush])

  const retry = useCallback(() => {
    dirty.current = true
    void flush()
  }, [flush])

  const keepMine = useCallback(() => {
    if (!conflict) return
    base.current = conflict.version
    blocked.current = false
    setConflict(null)
    writeDraft(ideaId, { baseVersion: base.current, ...latest.current })
    dirty.current = true
    void flush()
  }, [conflict, ideaId, flush])

  const takeServer = useCallback(() => {
    if (!conflict) return
    clearDraft(ideaId)
    adopt(conflict)
    blocked.current = false
    dirty.current = false
    setConflict(null)
    setSync('saved')
    setError(null)
  }, [conflict, ideaId, adopt])

  return { load, content, sync, error, notice, conflict, edit, retry, keepMine, takeServer, reload: open }
}
