import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilmCard from '@/components/FilmCard'
import type { ContentIdea } from '@/types/content'
import type { FilmPacket } from '@/types/film'

const store = vi.hoisted(() => ({
  getPacket: vi.fn(), createPacket: vi.fn(), savePacket: vi.fn(),
  readDraft: vi.fn(), writeDraft: vi.fn(), clearDraft: vi.fn(),
}))
vi.mock('@/lib/filmStore', () => store)

const idea = {
  id: 'i1', title: 'Deadlift setup', body: 'My caption', pillar: 'training', platform: 'both', status: 'READY',
  hook: null, hook_first_2s: 'Stop rounding', viewer_payoff: 'Stronger pull',
} as unknown as ContentIdea

let version = 1
const packet = (over: Partial<FilmPacket> = {}): FilmPacket => ({
  id: 'p1', content_idea_id: 'i1', state: 'filming', version,
  shots: [
    { id: 'a', label: 'Hook shot', filmed: false, takes: [] },
    { id: 'b', label: 'Demo shot', filmed: false, takes: [] },
    { id: 'c', label: 'Payoff shot', filmed: false, takes: [] },
  ],
  ...over,
})
const value = (el: HTMLElement) => (el as HTMLInputElement).value
const disabled = (el: HTMLElement) => (el as HTMLInputElement).disabled

beforeEach(() => {
  version = 1
  Object.values(store).forEach(f => f.mockReset())
  store.readDraft.mockReturnValue(null)
  store.getPacket.mockImplementation(async () => packet())
  // every save succeeds and bumps the version, echoing the saved content
  store.savePacket.mockImplementation(async (_id: string, _base: number, c: { shots: FilmPacket['shots']; state: FilmPacket['state'] }) => ({
    ok: true, packet: { ...packet(), ...c, version: ++version },
  }))
})

const open = async () => {
  const user = userEvent.setup()
  render(<FilmCard idea={idea} onBack={() => {}} />)
  await screen.findByText('Stronger pull')
  return user
}

describe('FilmCard', () => {
  it('pins the promise and hook and shows the first shot', async () => {
    await open()
    expect(screen.getByText('Stronger pull')).toBeTruthy()
    expect(screen.getByText('Stop rounding')).toBeTruthy()
    expect(value(screen.getByLabelText('Shot label'))).toBe('Hook shot')
  })

  it('flags a filmed shot with no take, and clears the flag when a take ref is typed', async () => {
    const user = await open()
    await user.click(screen.getByLabelText('Filmed'))
    expect(screen.getByText('Missing take')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Add take' }))
    await user.type(screen.getByLabelText('Take reference'), 'IMG_1.mov')
    expect(screen.queryByText('Missing take')).toBeNull()
    await waitFor(() => expect(store.savePacket).toHaveBeenCalled())
  })

  it('moves a shot later (the card follows it) and removes it', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Move later' }))
    expect(value(screen.getByLabelText('Shot label'))).toBe('Hook shot')   // Hook is now shot 2 and the card stays on it
    expect(screen.getByText('Shot 2 of 3')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove shot' }))
    expect(screen.getByText('Shot 2 of 2')).toBeTruthy()                    // Payoff shot is now second of two
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(screen.getByText('2 shots')).toBeTruthy()
  })

  it('last step lists missing takes, warns, and marks ready to edit without touching the idea status', async () => {
    const user = await open()
    await user.click(screen.getByLabelText('Filmed'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    const missing = screen.getByRole('region', { name: 'Missing takes' })
    expect(within(missing).getByText('Hook shot')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mark ready to edit' }))
    expect(screen.getByText(/missing a take/i)).toBeTruthy()
    await waitFor(() => {
      const calls = store.savePacket.mock.calls
      expect(calls[calls.length - 1][2].state).toBe('ready_to_edit')
    })
    expect(idea.status).toBe('READY')
  })

  it('copies the packet text', async () => {
    const user = await open()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await user.click(screen.getByRole('button', { name: 'Copy packet' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Deadlift setup'))
    expect(await screen.findByText('Copied')).toBeTruthy()
  })

  it('shows Unsynced with Retry when the save fails, keeps the draft, and Retry saves', async () => {
    store.savePacket.mockRejectedValueOnce(new Error('offline'))
    const user = await open()
    await user.click(screen.getByLabelText('Filmed'))
    expect(await screen.findByText('Unsynced')).toBeTruthy()
    expect(store.clearDraft).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  it('shows the conflict prompt with Keep mine / Use theirs and locks editing', async () => {
    store.savePacket.mockResolvedValueOnce({ ok: false, packet: packet({ version: 7 }) })
    const user = await open()
    await user.click(screen.getByLabelText('Filmed'))
    expect(await screen.findByText(/changed elsewhere/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use theirs' })).toBeTruthy()
    expect(disabled(screen.getByLabelText('Filmed'))).toBe(true)
  })

  it('resumes an unsynced draft on open', async () => {
    store.readDraft.mockReturnValue({ baseVersion: 1, state: 'filming', shots: [{ id: 'a', label: 'Resumed shot', filmed: false, takes: [] }] })
    render(<FilmCard idea={idea} onBack={() => {}} />)
    expect(await screen.findByDisplayValue('Resumed shot')).toBeTruthy()
    expect(screen.getByText(/Restored unsynced edits/)).toBeTruthy()
  })
})
