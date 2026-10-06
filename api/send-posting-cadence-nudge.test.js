// @vitest-environment node
// Codex portfolio audit 2026-10-06, finding 5: the posting nudge turned a failed dependency into "empty". A failed subscriptions
// read looked like "no subscriptions" (HTTP 200, so the workflow stayed green with nothing pushed), a failed READY read produced the
// false "Nothing approved yet", a malformed stored endpoint made new URL() throw inside the catch and abandoned the remaining
// subscribers, and no read had a deadline. The GitHub workflow (.github/workflows/posting-cadence-nudge.yml) already fails the job
// on any non-200, and on message "Pushed" with sent != total: those two contracts must stay exactly as they are.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

let handle, webpush
const realFetch = globalThis.fetch

beforeAll(async () => {
  webpush = (await import('web-push')).default
  const keys = webpush.generateVAPIDKeys()
  process.env.VAPID_PUBLIC_KEY = keys.publicKey
  process.env.VAPID_PRIVATE_KEY = keys.privateKey
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  ;({ handleSendPostingCadenceNudgeRequest: handle } = await import('./send-posting-cadence-nudge.js'))
})

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const SUB = (n) => ({ endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'a' })
const hang = (init) => new Promise((_resolve, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }) })

// Routes the four Supabase calls the handler makes; any override replaces one of them.
function route(overrides = {}) {
  const calls = { deletes: [], bounded: [] }
  const h = {
    recent: () => json(200, []),
    ready: () => json(200, [{ id: 'a', title: 'Top idea', predicted_score: 9 }]),
    subs: () => json(200, [SUB(1)]),
    ...overrides,
  }
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (init.method === 'DELETE') { calls.deletes.push(u); return json(200, []) }
    calls.bounded.push(init.signal instanceof AbortSignal)
    if (u.includes('posted_at=not.is.null')) return h.recent(init)
    if (u.includes('status=eq.READY')) return h.ready(init)
    if (u.includes('push_subscriptions?app=eq.content')) return h.subs(init)
    throw new Error('unexpected fetch ' + u)
  })
  return calls
}

let send
beforeEach(() => { send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({}) })
afterEach(() => { vi.restoreAllMocks(); globalThis.fetch = realFetch; delete process.env.NUDGE_READ_TIMEOUT_MS })

describe('handleSendPostingCadenceNudgeRequest', () => {
  it('unchanged: nothing is sent when something was already posted today', async () => {
    route({ recent: () => json(200, [{ posted_at: new Date().toISOString() }]) })
    const r = await handle()
    expect(r).toEqual({ status: 200, body: { message: 'Posted today, no push sent' } })
    expect(send).not.toHaveBeenCalled()
  })

  it('unchanged: a genuinely empty subscription list is a quiet 200', async () => {
    route({ subs: () => json(200, []) })
    expect(await handle()).toEqual({ status: 200, body: { message: 'No subscriptions, no push sent' } })
    expect(send).not.toHaveBeenCalled()
  })

  it('unchanged: a normal run pushes the top ready idea and reports sent/total', async () => {
    route()
    const r = await handle()
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ message: 'Pushed', sent: 1, total: 1, failures: [] })
    expect(JSON.parse(send.mock.calls[0][1]).body).toContain('Top idea')
  })

  it('a FAILED subscriptions read is a 502, not "no subscriptions" (the silent-green case)', async () => {
    route({ subs: () => json(401, { message: 'Invalid API key' }) })
    const r = await handle()
    expect(r.status).toBe(502)
    expect(r.body.error).toBe('dependency_unavailable')
    expect(r.body.which).toBe('subscriptions')
    expect(send).not.toHaveBeenCalled()
  })

  it('a subscriptions payload that is not a list is also a 502', async () => {
    route({ subs: () => json(200, { message: 'weird' }) })
    const r = await handle()
    expect(r.status).toBe(502)
    expect(r.body.which).toBe('subscriptions')
  })

  it('a FAILED recent-posts read is a readable 502, not a thrown TypeError', async () => {
    route({ recent: () => json(500, { message: 'db down' }) })
    const r = await handle()
    expect(r.status).toBe(502)
    expect(r.body.which).toBe('recent_posts')
    expect(send).not.toHaveBeenCalled()
  })

  it('a FAILED ready-ideas read still nudges, but without the false "Nothing approved yet", and says it degraded', async () => {
    route({ ready: () => json(500, { message: 'db down' }) })
    const r = await handle()
    expect(r.status).toBe(200)
    expect(r.body.message).toBe('Pushed')
    expect(r.body.degraded).toEqual(['ready_ideas'])
    const pushed = JSON.parse(send.mock.calls[0][1]).body
    expect(pushed).toContain('No content posted today.')
    expect(pushed).not.toContain('Nothing approved yet')
  })

  it('a malformed stored endpoint cannot abandon the remaining subscribers', async () => {
    route({ subs: () => json(200, [{ endpoint: 'not a url', p256dh: 'p', auth: 'a' }, SUB(2)]) })
    send.mockRejectedValueOnce(Object.assign(new Error('bad endpoint'), { statusCode: 400 }))
    const r = await handle()
    expect(r.status).toBe(200)
    expect(r.body.sent).toBe(1)
    expect(r.body.total).toBe(2)
    expect(r.body.failures).toEqual([{ endpointHost: 'invalid-endpoint', statusCode: 400, message: 'bad endpoint' }])
  })

  it('a dead (410) subscription is still deleted', async () => {
    const calls = route({ subs: () => json(200, [SUB(1)]) })
    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
    const r = await handle()
    expect(calls.deletes.length).toBe(1)
    expect(r.body.failures[0].statusCode).toBe(410)
  })

  it('contract with the workflow: every delivery failing is still 200 "Pushed" with sent < total (the job fails on that)', async () => {
    route({ subs: () => json(200, [SUB(1), SUB(2)]) })
    send.mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 500 }))
    const r = await handle()
    expect(r.status).toBe(200)
    expect(r.body.message).toBe('Pushed')
    expect(r.body.sent).toBe(0)
    expect(r.body.total).toBe(2)
    expect(r.body.failures.length).toBe(2)
  })

  it('every Supabase read carries a deadline, and a hung read becomes a 502 "timed out"', async () => {
    process.env.NUDGE_READ_TIMEOUT_MS = '20'
    const calls = route({ recent: hang })
    const r = await handle()
    expect(r.status).toBe(502)
    expect(r.body.which).toBe('recent_posts')
    expect(r.body.detail).toMatch(/timed out/)
    expect(calls.bounded.every(Boolean)).toBe(true)
  })

  it('a normal run makes exactly three Supabase reads and every one carries a deadline signal', async () => {
    const calls = route()
    await handle()
    expect(calls.bounded).toEqual([true, true, true]) // recent posts, subscriptions, ready ideas
  })

  it('a hung SUBSCRIPTIONS read is cut off too (502 "timed out")', async () => {
    process.env.NUDGE_READ_TIMEOUT_MS = '20'
    route({ subs: hang })
    const r = await handle()
    expect(r.status).toBe(502)
    expect(r.body.which).toBe('subscriptions')
    expect(r.body.detail).toMatch(/timed out/)
    expect(send).not.toHaveBeenCalled()
  })

  it('a hung READY read is cut off and the nudge still goes out, degraded', async () => {
    process.env.NUDGE_READ_TIMEOUT_MS = '20'
    route({ ready: hang })
    const r = await handle()
    expect(r.status).toBe(200)
    expect(r.body.degraded).toEqual(['ready_ideas'])
    expect(r.body.sent).toBe(1)
  })

  it('push sends get a timeout too', async () => {
    route()
    await handle()
    expect(send.mock.calls[0][2]).toEqual(expect.objectContaining({ timeout: 10_000 }))
  })

  it('the test-only read timeout cannot lengthen a deadline or apply in production', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    process.env.NUDGE_READ_TIMEOUT_MS = '1'
    route({ recent: async () => { await new Promise(r => setTimeout(r, 40)); return json(200, []) } })
    const r = await handle()
    process.env.NODE_ENV = prev
    expect(r.status).toBe(200) // a 1 ms deadline would have cut the 40 ms read off
  })
})
