import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/5',
        className
      )}
    />
  )
}

export function PosterSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative bg-surface-01 rounded-xl overflow-hidden">
      <div className="absolute inset-0">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-8 p-8 xl:p-12">
        <div className="xl:col-span-3">
          <Skeleton className="aspect-[2/3] rounded-lg" />
        </div>
        <div className="xl:col-span-9 space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <Skeleton className="h-32 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}