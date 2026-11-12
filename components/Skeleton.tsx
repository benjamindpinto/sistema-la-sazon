export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--paper-line)] rounded ${className}`} />
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-[var(--paper-card)] rounded-lg border border-[var(--paper-line)] overflow-hidden">
      <div className="border-b border-[var(--paper-line)] bg-[var(--paper)] px-6 py-3">
        <SkeletonBlock className="h-3 w-32" />
      </div>
      <div className="divide-y divide-[var(--paper-line)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <SkeletonBlock className="h-4 flex-1 max-w-[180px]" />
            <SkeletonBlock className="h-4 flex-1 max-w-[120px]" />
            <SkeletonBlock className="h-4 flex-1 max-w-[100px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--paper-card)] rounded-lg border border-[var(--paper-line)] p-6 space-y-3">
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}
