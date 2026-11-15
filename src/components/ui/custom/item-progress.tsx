import { Progress } from '@/components/ui/progress'
import type { CountProgress } from '@c/progress'

/** A counting project's or goal's progress, e.g. "140 / 350 pages". */
export function ItemProgress({ item }: { item: Partial<CountProgress> }) {
  const { progress_done: done, progress_total: total, progress_unit: unit } =
    item
  if (total == null || unit == null || done == null) return null
  const label = `${done} / ${total} ${unit}`
  return (
    <span className="inline-flex items-center gap-2">
      <Progress
        value={Math.min(100, (done / total) * 100)}
        aria-label={label}
        className="w-24"
      />
      <span className="tabular-nums">{label}</span>
    </span>
  )
}
