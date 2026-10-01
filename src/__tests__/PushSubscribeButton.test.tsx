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
})
