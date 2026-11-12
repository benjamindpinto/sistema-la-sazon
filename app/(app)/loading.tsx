import { SkeletonBlock } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <SkeletonBlock className="h-8 w-56" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
      </div>
      <SkeletonBlock className="h-72" />
    </div>
  )
}
