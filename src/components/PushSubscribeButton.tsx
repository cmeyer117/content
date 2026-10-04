import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// The public key from the VAPID pair generated for this app — safe to embed
// client-side, this is the public half.
const VAPID_PUBLIC_KEY = 'BJDYIuQYXDrhXuF6nv7QX-YH8GkWwIzt0P35oF5pv2pGJj56WRNgFEf17Ocu1Psl9h0u1njgiAIL0ej0O0Hvn-g'

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0))) as BufferSource
}

export default function PushSubscribeButton() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('Enable Notifications')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window
    const alreadySubscribed = localStorage.getItem('content_push_subscribed_v2')
    const denied = canPush && Notification.permission === 'denied'
    setVisible(canPush && !denied)
    if (alreadySubscribed) setLabel('Refresh Notifications')
  }, [])

  if (!visible) return null

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    setLabel('Enabling...')
    // Replacing a subscription means unsubscribing first, so from that point a failure leaves this browser with NO
    // subscription. `removedOld` lets the failure path stop claiming notifications are on (Codex review 2026-10-04).
    let removedOld = false
    const fail = () => {
      if (removedOld) {
        localStorage.removeItem('content_push_subscribed_v2')
        setError('Could not refresh notifications. Tap Enable Notifications to try again.')
      }
      setLabel('Enable Notifications')
      setBusy(false)
    }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setLabel(localStorage.getItem('content_push_subscribed_v2') ? 'Refresh Notifications' : 'Enable Notifications')
        setBusy(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await existing.unsubscribe()
        removedOld = true
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/subscribe-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) {
        // fetch() only rejects on network failure, not on a non-2xx status
        // (e.g. a 502 from a failed Supabase upsert) — without this check,
        // a server-side failure gets silently treated as success.
        fail()
        return
      }
      localStorage.setItem('content_push_subscribed_v2', '1')
      setError(null)
      setLabel('Notifications enabled')
      setVisible(false)
    } catch {
      fail()
    }
  }

  return (
    <div className="mb-4">
      {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
      <button
        onClick={() => void handleClick()}
        disabled={busy}
        className="w-full px-3 py-2 rounded text-sm bg-card border border-border text-accent disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  )
}
