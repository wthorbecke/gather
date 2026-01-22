'use client'

interface SegmentedProgressProps {
  completed: number
  total: number
  height?: number
}

export function SegmentedProgress({ completed, total, height = 4 }: SegmentedProgressProps) {
  if (total === 0) return null

  return (
    <div className="flex gap-[3px]" style={{ height }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm progress-segment ${
            i < completed ? 'bg-success' : 'bg-border'
          }`}
          style={{ transitionDelay: `${i * 30}ms` }}
        />
      ))}
    </div>
  )
}
