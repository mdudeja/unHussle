export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  // Format parts to always be at least 2 digits (00)
  const pad = (n: number) => n.toString().padStart(2, '0')

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`
  }
  return `${m}:${pad(s)}`
}
