import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'

type PendingCapture = {
  name: string
  createdAt: Date
}

export default function Capture() {
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [listing, setListing] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setListing(true)
    try {
      const { data, error: readError } = await supabase.storage.from('raw-captures').list()
      if (readError) throw readError
      if (!data) throw new Error('Capture list unavailable')
      setPending(data.map(o => ({ name: o.name, createdAt: new Date(o.created_at ?? Date.now()) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
      setListError(null)
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? String(err.message) : String(err)
      setListError(`Could not check waiting captures: ${message}`)
    } finally {
      setListing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setLastFile(file)
    try {
      const objectName = captureObjectName(file)
      const { error: uploadError } = await supabase.storage
        .from('raw-captures')
        .upload(objectName, file, { upsert: false, contentType: file.type })
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        return
      }
      setLastFile(null)
      await refresh()
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err ? String(err.message) : String(err)
      setError(`Upload not confirmed: ${message}. Check the waiting list before retrying.`)
    } finally {
      setUploading(false)
    }
  }, [refresh])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void doUpload(file)
  }

  const handleRetry = () => {
    if (lastFile) void doUpload(lastFile)
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Capture</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a take. content-autopilot picks it up on its next sweep (11am / 6pm) —
          same transcription, captions, hooks, and Telegram review it already does.
        </p>
      </div>

      <label className="bg-accent text-white rounded-lg py-3 px-4 text-sm font-medium text-center cursor-pointer disabled:opacity-40">
        {uploading ? 'Uploading...' : 'Upload a take'}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          aria-label="Upload a take"
          disabled={uploading}
          onChange={handleChange}
        />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={handleRetry}
            className="text-sm font-medium text-red-700 underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Waiting for next sweep
        </p>
        {listError ? (
          <div role="alert" className="text-sm text-red-700">
            {listError} <button type="button" disabled={listing} onClick={() => { void refresh() }} className="underline">Check again</button>
          </div>
        ) : listing ? (
          <p className="text-sm text-gray-400">Checking waiting captures...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map(p => (
              <li
                key={p.name}
                className="bg-card border border-border rounded-lg px-4 py-2 flex items-center justify-between text-sm"
              >
                <span className="text-gray-900 truncate">{p.name}</span>
                <span className="text-gray-400 shrink-0 ml-2">{formatCaptureAge(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
