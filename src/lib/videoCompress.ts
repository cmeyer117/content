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
