import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFilmPacket } from '@/hooks/useFilmPacket'
import { updateShot } from '@/lib/filmPacket'
import type { FilmContent, FilmDraft, FilmPacket, FilmShot } from '@/types/film'

const store = vi.hoisted(() => ({
  getPacket: vi.fn(),
  createPacket: vi.fn(),
  savePacket: vi.fn(),
  readDraft: vi.fn(),
  writeDraft: vi.fn(),
  clearDraft: vi.fn(),
}))
vi.mock('@/lib/filmStore', () => store)

const shot = (id: string): FilmShot => ({ id, label: id, filmed: false, takes: [] })
const server = (version = 1, shots: FilmShot[] = [shot('a'), shot('b'), shot('c')]): FilmPacket => ({
  id: 'p1', content_idea_id: 'i1', shots, state: 'filming', version,
})
const idea = { id: 'i1', hook: null, hook_first_2s: 'Hook', body: 'Demo', viewer_payoff: 'Payoff' }
const markFilmed = (c: FilmContent): FilmContent => ({ ...c, shots: updateShot(c.shots, 'a', { filmed: true }) })

beforeEach(() => {
  Object.values(store).forEach(f => f.mockReset())
  store.readDraft.mockReturnValue(null)
})

describe('useFilmPacket', () => {
  it('loads an existing packet', async () => {
    store.getPacket.mockResolvedValue(server())
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    expect(result.current.content.shots).toHaveLength(3)
    expect(result.current.sync).toBe('saved')
    expect(store.createPacket).not.toHaveBeenCalled()
  })

  it('seeds three shots when no packet exists', async () => {
    store.getPacket.mockResolvedValue(null)
    store.createPacket.mockResolvedValue(server())
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    expect(store.createPacket).toHaveBeenCalledTimes(1)
    expect(store.createPacket.mock.calls[0][1]).toHaveLength(3)
  })

  it('writes the draft first, saves against the base version, and clears the draft only after confirmation', async () => {
    store.getPacket.mockResolvedValue(server(1))
    let resolveSave!: (v: unknown) => void
    store.savePacket.mockReturnValue(new Promise(res => { resolveSave = res }))
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    act(() => { result.current.edit(markFilmed) })
    expect(store.writeDraft).toHaveBeenCalled()
    expect(store.writeDraft.mock.calls[0][1]).toMatchObject({ baseVersion: 1 })
    await waitFor(() => expect(store.savePacket).toHaveBeenCalled())
    expect(store.clearDraft).not.toHaveBeenCalled()
    expect(store.savePacket.mock.calls[0][1]).toBe(1)
    await act(async () => { resolveSave({ ok: true, packet: server(2, result.current.content.shots) }) })
    await waitFor(() => expect(result.current.sync).toBe('saved'))
    expect(store.clearDraft).toHaveBeenCalledWith('i1')
  })

  it('keeps the draft and shows Unsynced on a failed save; retry saves it exactly once', async () => {
    store.getPacket.mockResolvedValue(server(1))
    store.savePacket.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    await act(async () => { result.current.edit(markFilmed) })
    await waitFor(() => expect(result.current.sync).toBe('unsynced'))
    expect(result.current.error).toMatch(/kept on this device/)
    expect(store.clearDraft).not.toHaveBeenCalled()
    store.savePacket.mockResolvedValueOnce({ ok: true, packet: server(2, result.current.content.shots) })
    await act(async () => { result.current.retry() })
    await waitFor(() => expect(result.current.sync).toBe('saved'))
    expect(store.savePacket).toHaveBeenCalledTimes(2)
    expect(store.clearDraft).toHaveBeenCalledTimes(1)
  })

  it('resumes an unsynced draft whose base is the server version', async () => {
    const draft: FilmDraft = { baseVersion: 1, shots: [{ ...shot('a'), filmed: true }], state: 'filming' }
    store.getPacket.mockResolvedValue(server(1))
    store.readDraft.mockReturnValue(draft)
    store.savePacket.mockResolvedValue({ ok: true, packet: server(2, draft.shots) })
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    expect(result.current.content.shots).toHaveLength(1)
    expect(result.current.notice).toMatch(/unsynced edits/)
    // the resumed edits are sent to the server on their own
    await waitFor(() => expect(store.savePacket).toHaveBeenCalled())
    await waitFor(() => expect(result.current.sync).toBe('saved'))
  })

  it('enters conflict when someone else saved first; Keep mine re-saves on the new version', async () => {
    store.getPacket.mockResolvedValue(server(1))
    store.savePacket.mockResolvedValueOnce({ ok: false, packet: server(4, [shot('x')]) })
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    await act(async () => { result.current.edit(markFilmed) })
    await waitFor(() => expect(result.current.sync).toBe('conflict'))
    expect(result.current.conflict?.version).toBe(4)
    // editing is blocked while the conflict is unresolved
    const before = result.current.content
    act(() => { result.current.edit(c => ({ ...c, state: 'ready_to_edit' })) })
    expect(result.current.content).toBe(before)

    store.savePacket.mockResolvedValueOnce({ ok: true, packet: server(5, result.current.content.shots) })
    await act(async () => { result.current.keepMine() })
    await waitFor(() => expect(result.current.sync).toBe('saved'))
    expect(store.savePacket.mock.calls[1][1]).toBe(4)
  })

  it('Use theirs discards the draft and shows the server content', async () => {
    store.getPacket.mockResolvedValue(server(1))
    store.savePacket.mockResolvedValueOnce({ ok: false, packet: server(4, [shot('x')]) })
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('ready'))
    await act(async () => { result.current.edit(markFilmed) })
    await waitFor(() => expect(result.current.sync).toBe('conflict'))
    act(() => { result.current.takeServer() })
    expect(result.current.sync).toBe('saved')
    expect(result.current.content.shots.map(s => s.id)).toEqual(['x'])
    expect(store.clearDraft).toHaveBeenCalledWith('i1')
  })

  it('reports a load error and reload retries', async () => {
    store.getPacket.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useFilmPacket(idea))
    await waitFor(() => expect(result.current.load).toBe('error'))
    store.getPacket.mockResolvedValueOnce(server())
    await act(async () => { await result.current.reload() })
    await waitFor(() => expect(result.current.load).toBe('ready'))
  })
})
