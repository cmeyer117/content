import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const MAX_TARGET_BYTES = 48 * 1024 * 1024
const MAX_BITRATE_BPS = 8_000_000

// Uses close to the full available upload budget on short clips instead of
// a flat conservative bitrate that wastes quality, while still degrading
// gracefully (lower bitrate, not failure) for long clips.
export function computeTargetBitrate(durationSeconds: number): number {
  const budgetBasedBitrate = (MAX_TARGET_BYTES * 8) / durationSeconds
  return Math.min(MAX_BITRATE_BPS, Math.floor(budgetBasedBitrate))
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
  return new File([(data as Uint8Array).slice()], outputFileName, { type: 'video/mp4' })
}
