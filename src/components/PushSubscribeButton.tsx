import { useEffect, useState } from 'react'

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

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window
    const alreadySubscribed = localStorage.getItem('content_push_subscribed')
    const denied = canPush && Notification.permission === 'denied'
    setVisible(canPush && !alreadySubscribed && !denied)
  }, [])

  if (!visible) return null

  const handleClick = async () => {
    setBusy(true)
    setLabel('Enabling...')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setLabel('Enable Notifications')
        setBusy(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await fetch('/api/subscribe-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      localStorage.setItem('content_push_subscribed', '1')
      setLabel('Notifications enabled')
      setVisible(false)
    } catch (e) {
      setLabel('Enable Notifications')
      setBusy(false)
    }
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={busy}
      className="w-full mb-4 px-3 py-2 rounded text-sm bg-card border border-border text-accent disabled:opacity-40"
    >
      {label}
    </button>
  )
}
