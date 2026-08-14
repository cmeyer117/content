import { describe, it, expect } from 'vitest'
import { buildSubscribeUpsertRequest, verifyOwner } from './subscribe-push-logic.js'

describe('buildSubscribeUpsertRequest', () => {
  it('new subscription — POST with merge-duplicates on endpoint conflict', () => {
    const req = buildSubscribeUpsertRequest('content', 'https://fcm.example/abc', { p256dh: 'p1', auth: 'a1' })
    expect(req.url.includes('on_conflict=endpoint')).toBe(true)
    expect(req.options.method).toBe('POST')
    expect(req.options.headers.Prefer.includes('resolution=merge-duplicates')).toBe(true)
    const body = JSON.parse(req.options.body)
    expect(body).toEqual({ app: 'content', endpoint: 'https://fcm.example/abc', p256dh: 'p1', auth: 'a1' })
  })

  it('re-subscribe with same endpoint produces an identical request shape', () => {
    const first = buildSubscribeUpsertRequest('content', 'https://fcm.example/abc', { p256dh: 'p1', auth: 'a1' })
    const second = buildSubscribeUpsertRequest('content', 'https://fcm.example/abc', { p256dh: 'p2', auth: 'a2' })
    expect(first.url).toBe(second.url)
    expect(first.options.headers.Prefer).toBe(second.options.headers.Prefer)
    expect(JSON.parse(first.options.body)).not.toEqual(JSON.parse(second.options.body))
  })
})

describe('verifyOwner', () => {
  it('rejects a missing header', async () => {
    expect(await verifyOwner(undefined)).toBe(false)
  })

  it('rejects when the auth lookup fails', async () => {
    const fetchImpl = async () => ({ ok: false })
    expect(await verifyOwner('Bearer bad-token', fetchImpl)).toBe(false)
  })

  it('rejects a valid session for a non-owner email', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ email: 'someone-else@example.com' }) })
    expect(await verifyOwner('Bearer some-token', fetchImpl)).toBe(false)
  })

  it('accepts a valid session for the owner email', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ email: 'carl.meyer.business@gmail.com' }) })
    expect(await verifyOwner('Bearer some-token', fetchImpl)).toBe(true)
  })
})
