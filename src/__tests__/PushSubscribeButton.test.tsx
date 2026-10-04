import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PushSubscribeButton from '@/components/PushSubscribeButton'

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: getSessionMock } } }))

describe('PushSubscribeButton', () => {
  beforeEach(() => {
    localStorage.clear()
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'owner-token' } } })
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') },
    })
  })

  it('offers refresh when locally marked subscribed and replaces the saved browser subscription', async () => {
    localStorage.setItem('content_push_subscribed_v2', '1')
    const oldSubscription = { unsubscribe: vi.fn().mockResolvedValue(true) }
    const freshSubscription = { toJSON: () => ({ endpoint: 'https://push.example/new' }) }
    const subscribe = vi.fn().mockResolvedValue(freshSubscription)
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(oldSubscription), subscribe } }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<PushSubscribeButton />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Notifications' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ endpoint: 'https://push.example/new' })
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  })

  // Codex review (2026-10-04): replacing a subscription unsubscribes first, so a failure after that point must not leave the
  // app claiming notifications are on. Nothing is claimed after a failure, and the failure is visible.
  function setupRefresh(opts: { subscribe: () => Promise<unknown>; fetchResult?: { ok: boolean } | Error }) {
    localStorage.setItem('content_push_subscribed_v2', '1')
    const oldSubscription = { unsubscribe: vi.fn().mockResolvedValue(true) }
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(oldSubscription), subscribe: vi.fn(opts.subscribe) } }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } })
    const fetchMock = vi.fn().mockImplementation(() => (opts.fetchResult instanceof Error ? Promise.reject(opts.fetchResult) : Promise.resolve(opts.fetchResult ?? { ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    return { oldSubscription, fetchMock }
  }

  it('a subscribe failure after the old subscription was removed clears the "subscribed" flag and says so', async () => {
    const { oldSubscription } = setupRefresh({ subscribe: () => Promise.reject(new Error('push service down')) })
    render(<PushSubscribeButton />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Notifications' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not refresh notifications/i)
    expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce()
    expect(localStorage.getItem('content_push_subscribed_v2')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enable Notifications' })).toBeTruthy()
  })

  it('a server rejection after the old subscription was removed does the same', async () => {
    setupRefresh({ subscribe: () => Promise.resolve({ toJSON: () => ({ endpoint: 'https://push.example/new' }) }), fetchResult: { ok: false } })
    render(<PushSubscribeButton />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Notifications' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not refresh notifications/i)
    expect(localStorage.getItem('content_push_subscribed_v2')).toBeNull()
  })

  it('refusing the permission prompt changes nothing: no unsubscribe, flag kept, no error shown', async () => {
    const { oldSubscription } = setupRefresh({ subscribe: () => Promise.resolve({}) })
    ;(Notification as unknown as { requestPermission: ReturnType<typeof vi.fn> }).requestPermission.mockResolvedValue('default')
    render(<PushSubscribeButton />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Notifications' }))
    await waitFor(() => expect(Notification.requestPermission).toHaveBeenCalled())
    expect(oldSubscription.unsubscribe).not.toHaveBeenCalled()
    expect(localStorage.getItem('content_push_subscribed_v2')).toBe('1')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a successful retry after a failure clears the error', async () => {
    let calls = 0
    setupRefresh({ subscribe: () => (++calls === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve({ toJSON: () => ({ endpoint: 'https://push.example/ok' }) })) })
    render(<PushSubscribeButton />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Notifications' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Enable Notifications' }))
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(localStorage.getItem('content_push_subscribed_v2')).toBe('1')
  })
})
