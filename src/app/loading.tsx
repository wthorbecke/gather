/**
 * Loading skeleton shown immediately while page loads
 * This improves FCP by rendering a lightweight skeleton server-side
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Skeleton header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="px-5 py-4">
          <div className="max-w-[540px] mx-auto">
            <div className="flex justify-between items-center">
              <div className="h-9 w-28 bg-surface rounded-lg animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 bg-surface rounded-lg animate-pulse" />
                <div className="w-11 h-11 bg-surface rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Skeleton content */}
      <div className="px-5 py-6">
        <div className="max-w-[540px] mx-auto space-y-4">
          {/* Skeleton input */}
          <div className="h-14 bg-surface rounded-2xl animate-pulse" />
          {/* Skeleton task cards */}
          <div className="space-y-3 pt-2">
            <div className="h-[72px] bg-surface rounded-md animate-pulse" />
            <div className="h-[72px] bg-surface rounded-md animate-pulse opacity-75" />
            <div className="h-[72px] bg-surface rounded-md animate-pulse opacity-50" />
          </div>
        </div>
      </div>
    </div>
  )
}
