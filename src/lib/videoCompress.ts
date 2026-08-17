import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const MAX_TARGET_BYTES = 48 * 1024 * 1024
const MAX_BITRATE_BPS = 8_000_000
const AUDIO_BITRATE_BPS = 128_000
// Generous ceiling on the *source* file -- ffmpeg.wasm holds the whole file
// (input + output) in browser memory, so an enormous accidental selection
// (wrong file from camera roll) should fail fast with a clear message
// instead of crashing the tab.
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024

// Uses close to the full available upload budget on short clips instead of
// a flat conservative bitrate that wastes quality, while still degrading
// gracefully (lower bitrate, not failure) for long clips. Audio is
// reserved out of the byte budget up front -- otherwise the audio track
// pushes the total past the budget on top of an already-full video track.
export function computeTargetBitrate(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return MAX_BITRATE_BPS
  const totalBudgetBitrate = (MAX_TARGET_BYTES * 8) / durationSeconds
  const videoBudgetBitrate = totalBudgetBitrate - AUDIO_BITRATE_BPS
  return Math.max(0, Math.min(MAX_BITRATE_BPS, Math.floor(videoBudgetBitrate)))
}

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
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('File is too large to compress in the browser -- trim it first')
  }

  const duration = await getVideoDuration(file)
  // Infinity/NaN duration is a real browser quirk (some malformed/streaming
  // MP4s), but it tells us nothing about the clip's real length -- guessing
  // a bitrate here could silently produce a huge file for a genuinely long
  // clip. Fail loud instead; the caller's existing error UI surfaces this.
  if (!Number.isFinite(duration)) {
    throw new Error('Could not determine video length -- try trimming or re-exporting the clip')
  }

  const bitrate = computeTargetBitrate(duration)
  const ffmpeg = await getFFmpeg()

  const inputExt = /\.\w+$/.exec(file.name)?.[0] ?? '.mp4'
  const inputName = `input${inputExt}`
  const outputName = 'output.mp4'

  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
    const returnCode = await ffmpeg.exec([
      '-i', inputName,
      '-vf', 'scale=1920:1920:force_original_aspect_ratio=decrease',
      '-b:v', `${bitrate}`,
      '-b:a', '128k',
      outputName,
    ])
    if (returnCode !== 0) {
      throw new Error(`ffmpeg exited with code ${returnCode}`)
    }
    const data = await ffmpeg.readFile(outputName)
    const outputFileName = file.name.replace(/\.\w+$/, '.mp4')
    return new File([(data as Uint8Array).slice()], outputFileName, { type: 'video/mp4' })
  } finally {
    // Best-effort -- a file that was never written (e.g. writeFile itself
    // threw) would make deleteFile throw too, which would mask the real
    // error above if left uncaught here.
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
