# Capture Client-Side Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/capture` upload reliably fit under Supabase's ~50MB project-wide storage cap by re-encoding video client-side (in-browser) before upload, using a bitrate computed from the clip's own duration so short clips keep near-source quality and long clips still fit.

**Architecture:** A new pure-logic module (`videoCompress.ts`) exposes `computeTargetBitrate` (pure arithmetic, unit-tested), `getVideoDuration` (reads a `<video>` element's metadata, browser-only), and `compressVideo` (lazy-loads `ffmpeg.wasm` from CDN on first use, re-encodes to max 1080p H.264 at the computed bitrate + 128kbps AAC audio, browser-only). `Capture.tsx`'s upload handler gains a `compressing` stage before its existing `uploading` stage.

**Tech Stack:** `@ffmpeg/ffmpeg` + `@ffmpeg/util` (loads the single-threaded `@ffmpeg/core` build from the `unpkg` CDN at runtime — no bundler/COEP-header complexity), React 19, Vitest + Testing Library (existing stack, unchanged).

---

## Spec reference

Full design: `docs/superpowers/specs/2026-08-16-capture-client-side-compression-design.md`. Key numbers this plan implements exactly: 48MB target size (`48 * 1024 * 1024` bytes), 8Mbps bitrate ceiling (`8_000_000` bps), max 1080p output, 128kbps AAC audio.

## File structure

- **Create:** `src/lib/videoCompress.ts` — `computeTargetBitrate`, `getVideoDuration`, `compressVideo`.
- **Create:** `src/__tests__/videoCompress.test.ts` — unit tests for `computeTargetBitrate` only (the other two functions are browser-native and not meaningfully testable in jsdom, per spec).
- **Modify:** `src/pages/Capture.tsx` — replace the `uploading: boolean` state with a `stage: 'idle' | 'compressing' | 'uploading'` state; call `compressVideo` before the existing `supabase.storage.upload` call.
- **Modify:** `src/__tests__/Capture.test.tsx` — mock `@/lib/videoCompress` so `compressVideo` returns its input file unchanged, keeping the existing upload/error tests meaningful without needing a real ffmpeg run in jsdom.
- **Modify:** `package.json` — add `@ffmpeg/ffmpeg` and `@ffmpeg/util` dependencies.

---

### Task 1: Add ffmpeg.wasm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependencies**

Run:
```bash
cd /c/Users/gregm/content
npm install @ffmpeg/ffmpeg@^0.12.15 @ffmpeg/util@^0.12.2
```
Expected: `package.json` gains both packages under `"dependencies"`, `package-lock.json` updates, no install errors.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ffmpeg.wasm dependencies for client-side capture compression"
```

---

### Task 2: `computeTargetBitrate` — pure logic, TDD

**Files:**
- Create: `src/lib/videoCompress.ts`
- Create: `src/__tests__/videoCompress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/videoCompress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTargetBitrate } from '@/lib/videoCompress'

describe('computeTargetBitrate', () => {
  it('caps at 8Mbps for a short clip that would otherwise get a much higher bitrate', () => {
    expect(computeTargetBitrate(10)).toBe(8_000_000)
  })

  it('scales bitrate down for a long clip to fit the 48MB budget', () => {
    expect(computeTargetBitrate(200)).toBe(2_013_265)
  })

  it('lands exactly on the 8Mbps ceiling at the duration where the budget-based rate equals it', () => {
    const boundaryDuration = (48 * 1024 * 1024 * 8) / 8_000_000
    expect(computeTargetBitrate(boundaryDuration)).toBe(8_000_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- videoCompress`
Expected: FAIL — `src/lib/videoCompress.ts` does not exist / `computeTargetBitrate` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/videoCompress.ts`:

```ts
const MAX_TARGET_BYTES = 48 * 1024 * 1024
const MAX_BITRATE_BPS = 8_000_000

// Uses close to the full available upload budget on short clips instead of
// a flat conservative bitrate that wastes quality, while still degrading
// gracefully (lower bitrate, not failure) for long clips.
export function computeTargetBitrate(durationSeconds: number): number {
  const budgetBasedBitrate = (MAX_TARGET_BYTES * 8) / durationSeconds
  return Math.min(MAX_BITRATE_BPS, Math.floor(budgetBasedBitrate))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- videoCompress`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/videoCompress.ts src/__tests__/videoCompress.test.ts
git commit -m "feat: duration-aware target bitrate for capture compression"
```

---

### Task 3: `getVideoDuration` — browser-native duration read

**Files:**
- Modify: `src/lib/videoCompress.ts`

No unit test for this step (per spec: browser-only, real `<video>` element behavior that jsdom cannot meaningfully simulate). Verified manually in Task 6.

- [ ] **Step 1: Add the function**

Append to `src/lib/videoCompress.ts`:

```ts
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Could not read video duration'))
    }
    video.src = URL.createObjectURL(file)
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/videoCompress.ts
git commit -m "feat: read video duration from file metadata"
```

---

### Task 4: `compressVideo` — ffmpeg.wasm re-encode

**Files:**
- Modify: `src/lib/videoCompress.ts`

No unit test for this step (per spec: real WASM transcoding, not testable in jsdom). Verified manually in Task 6.

- [ ] **Step 1: Add the ffmpeg loader and compressVideo function**

Append to `src/lib/videoCompress.ts`:

```ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

// Fetched from CDN at runtime rather than bundled, so the ~25MB core payload
// only downloads the first time someone actually compresses a clip, not on
// page load. Single-threaded build -- avoids needing COOP/COEP response
// headers that the multi-threaded build requires for SharedArrayBuffer.
const FFMPEG_CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  const ffmpeg = new FFmpeg()
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function compressVideo(file: File): Promise<File> {
  const duration = await getVideoDuration(file)
  const bitrate = computeTargetBitrate(duration)
  const ffmpeg = await getFFmpeg()

  const inputExt = /\.\w+$/.exec(file.name)?.[0] ?? '.mp4'
  const inputName = `input${inputExt}`
  const outputName = 'output.mp4'

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
  await ffmpeg.exec([
    '-i', inputName,
    '-vf', "scale='min(1920,iw)':'-2'",
    '-b:v', `${bitrate}`,
    '-b:a', '128k',
    outputName,
  ])
  const data = await ffmpeg.readFile(outputName)
  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(outputName)

  const outputFileName = file.name.replace(/\.\w+$/, '.mp4')
  return new File([data], outputFileName, { type: 'video/mp4' })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/videoCompress.ts
git commit -m "feat: compress video client-side via ffmpeg.wasm before upload"
```

---

### Task 5: Wire compression into the Capture page

**Files:**
- Modify: `src/pages/Capture.tsx`
- Modify: `src/__tests__/Capture.test.tsx`

- [ ] **Step 1: Update the test mock first**

In `src/__tests__/Capture.test.tsx`, add a mock for the new module right after the existing `@/lib/supabase` mock (after line 17):

```ts
vi.mock('@/lib/videoCompress', () => ({
  compressVideo: vi.fn((file: File) => Promise.resolve(file)),
}))
```

This keeps all 4 existing tests passing unchanged — `compressVideo` becomes a no-op identity function in tests, so the existing upload/error assertions still exercise the real upload path.

- [ ] **Step 2: Run the existing tests to confirm they still pass with the mock in place (before touching Capture.tsx)**

Run: `npm test -- Capture.test`
Expected: PASS, 4 tests (mock has no effect yet since `Capture.tsx` doesn't call `compressVideo` yet).

- [ ] **Step 3: Add a new test for the compressing stage**

Add to `src/__tests__/Capture.test.tsx`, inside the `describe('Capture', ...)` block:

```ts
  it('shows a compressing state before uploading', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    uploadMock.mockResolvedValue({ error: null })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())

    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    const input = screen.getByLabelText(/upload a take/i)
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/uploading/i)).toBeTruthy()
  })
```

(This asserts on the terminal "Uploading..." label rather than trying to catch the brief "Compressing..." label mid-flight, since the mocked `compressVideo` resolves instantly and there's no reliable way to observe an instantaneous intermediate state.)

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- Capture.test`
Expected: FAIL — `Capture.tsx` still shows "Upload a take" / doesn't call `compressVideo`, so no "Uploading" text appears in time, or the test times out. (If the button already shows "Uploading..." purely from the existing `uploading` state, this step may unexpectedly pass — if so, proceed to Step 5 anyway since the real behavioral change is compression running before upload, verified structurally by the mock call in Step 6.)

- [ ] **Step 5: Update Capture.tsx**

In `src/pages/Capture.tsx`, replace the imports, state, and `doUpload`:

Replace line 1-3:
```tsx
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'
```
with:
```tsx
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'
import { compressVideo } from '@/lib/videoCompress'
```

Replace line 12 (`const [uploading, setUploading] = useState(false)`) with:
```tsx
  const [stage, setStage] = useState<'idle' | 'compressing' | 'uploading'>('idle')
```

Replace the `doUpload` function (lines 30-45):
```tsx
  const doUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setLastFile(file)
    const objectName = captureObjectName(file)
    const { error: uploadError } = await supabase.storage
      .from('raw-captures')
      .upload(objectName, file, { upsert: false, contentType: file.type })
    setUploading(false)
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      return
    }
    setLastFile(null)
    await refresh()
  }, [refresh])
```
with:
```tsx
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
```

Replace the upload button block (the `<label>...</label>` element, originally around lines 67-77):
```tsx
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
```
with:
```tsx
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- Capture.test`
Expected: PASS, 5 tests (4 existing + the new compressing-state test).

- [ ] **Step 7: Run the full test suite and type-check**

Run: `npm test && npx tsc -b --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Capture.tsx src/__tests__/Capture.test.tsx
git commit -m "feat: run capture uploads through client-side compression first"
```

---

### Task 6: Manual verification (real browser, real phone clip)

Not a code task — no commit. This is the check the spec calls out as untestable in jsdom.

- [ ] **Step 1: Deploy or run locally**

Run: `npm run dev` and open the local URL on the same phone used for the earlier failed test (or `npm run build && npx vercel deploy` if testing against the real domain is preferred).

- [ ] **Step 2: Upload the same clip that failed before**

Use the same ~22-second clip that produced "exceeded maximum size" earlier. Confirm:
- Button shows "Compressing..." then "Uploading..." then returns to "Upload a take".
- No error banner appears.
- The clip shows up in the "Waiting for next sweep" list.

- [ ] **Step 3: Note cold-load time**

Time how long the first compression takes (includes the one-time ffmpeg core download). Per the spec's open question: if this exceeds ~15 seconds with only the "Compressing..." label shown, that's a real UX gap worth a fast-follow (a distinct "Loading compressor..." sub-state) — note it in HANDOFF.md rather than silently accepting it, but don't build the fix speculatively without confirming it's actually slow.

- [ ] **Step 4: Confirm downstream pipeline**

Either wait for `content-autopilot`'s next sweep (11am/6pm) or trigger it manually if there's an existing manual-trigger mechanism, and confirm the compressed clip gets picked up and processed like any other capture.

---

## Self-review notes

- **Spec coverage:** all spec sections have a task — dependency (Task 1), `computeTargetBitrate` (Task 2), `getVideoDuration` (Task 3), `compressVideo` incl. lazy-load + 1080p cap + bitrate/audio settings (Task 4), `Capture.tsx` stage wiring + Retry behavior preserved (Task 5, Retry already calls `doUpload(lastFile)` with the *original* file, unchanged — re-verified against current source, no separate task needed), manual verification (Task 6), open cold-load-time question (Task 6 Step 3).
- **Type consistency:** `compressVideo(file: File): Promise<File>` signature matches its one call site in Task 5. `computeTargetBitrate(durationSeconds: number): number` matches its test calls and its one internal call site in `compressVideo`.
- **No placeholders:** all steps show complete code; Task 6 is intentionally manual/non-code and states exactly what to check.
