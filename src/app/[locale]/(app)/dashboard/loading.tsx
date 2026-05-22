/**
 * Dashboard-Loading-Skeleton.
 *
 * Wird automatisch von Next angezeigt, solange der Server-Component
 * (dashboard/page.tsx) seine Supabase-Queries läuft (~200-800 ms).
 * Vermeidet, dass die KPI-Cards und Charts ohne Vorboten erscheinen
 * und LCP / CLS-Werte verschlechtern.
 */

import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border p-5"
            aria-hidden="true"
          >
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="mb-2 h-7 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Two-column charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="rounded-2xl border p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>

      {/* Open invoices list */}
      <div className="rounded-2xl border p-5">
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
