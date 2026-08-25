import React from 'react'

// Shimmer skeletons. Base `.skeleton` class lives in index.css.

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded ${className}`} />
}

/** Card grid — banners, coloring, puzzles, gallery, videos, stories. */
export function SkeletonCards({ count = 6, className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Table / list rows — leaderboard, attempts, subscriptions, activity. */
export function SkeletonTable({ rows = 8, cols = 4 }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gray-700/50 flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-gray-700">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="px-4 py-4 flex items-center gap-4">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[40%]' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stat tiles — dashboard, analytics. */
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

/** Text block — detail panels, modals. */
export function SkeletonText({ lines = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Full detail page — attemptDetail, single record views. */
export function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <SkeletonStats count={4} />
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SkeletonText lines={6} />
      </div>
    </div>
  )
}

export default Skeleton
