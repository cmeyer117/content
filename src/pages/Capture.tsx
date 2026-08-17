import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'
import { compressVideo } from '@/lib/videoCompress'

type PendingCapture = {
  name: string
  createdAt: Date
}

export default function Capture() {
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [stage, setStage] = useState<'idle' | 'compressing' | 'uploading'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<File | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: listError } = await supabase.storage.from('raw-captures').list()
    if (listError || !data) return
    setPending(
      data
        .map(o => ({ name: o.name, createdAt: new Date(o.created_at ?? Date.now()) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doUpload = useCallback(async (file: File) => {
    setError(null)
    setLastFile(file)

    setStage('compressing')
    let compressed: File
    try {
      compressed = await compressVideo(file)
    } catch (err) {
      setStage('idle')
      setError(`Compression failed: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    setStage('uploading')
    const objectName = captureObjectName(compressed)
    const { error: uploadError } = await supabase.storage
      .from('raw-captures')
      .upload(objectName, compressed, { upsert: false, contentType: compressed.type })
    setStage('idle')
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return
    }
    setLastFile(null)
    await refresh()
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
        {stage === 'compressing' ? 'Compressing...' : stage === 'uploading' ? 'Uploading...' : 'Upload a take'}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          aria-label="Upload a take"
          disabled={stage !== 'idle'}
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
        {pending.length === 0 ? (
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
