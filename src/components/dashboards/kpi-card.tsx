import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  label: string
  value: string
  icon: LucideIcon
  tone?: "primary" | "emerald" | "amber" | "rose" | "blue"
  hint?: string
  className?: string
}

// Faktivo KPI: oversized mono numeric (text-3xl, weight 500 — Titan rule)
// with tabular-nums for finance-grade alignment. Tonal chip is rounded-2xl size-11.
//
// This component stays a server-renderable RSC (no "use client") — animations
// are CSS-only via tw-animate-css so we can keep accepting LucideIcon props
// without crossing the RSC/client boundary. fill-mode-both means the
// initial keyframe is rendered before the animation starts (prevents flash).
const TONES: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-foreground bg-foreground/8 dark:bg-foreground/12",
  emerald: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15",
  amber: "text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/15",
  rose: "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/15",
  blue: "text-blue-600 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/15",
}

const TONE_GLOWS: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-foreground/10",
  emerald: "bg-emerald-500/30",
  amber: "bg-amber-500/30",
  rose: "bg-rose-500/30",
  blue: "bg-blue-500/30",
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "group/kpi relative overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700",
        "transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/5 dark:hover:shadow-black/30",
        className
      )}
    >
      {/* Tonal glow that fades in on hover — adds quiet 'live' feel */}
      <div
        className={cn(
          "pointer-events-none absolute -top-10 -right-10 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover/kpi:opacity-60",
          TONE_GLOWS[tone]
        )}
        aria-hidden
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
              {label}
            </span>
            <div className="font-mono text-3xl font-medium tabular-nums tracking-tight">
              {value}
            </div>
            {hint ? (
              <span className="text-muted-foreground text-xs">{hint}</span>
            ) : null}
          </div>
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover/kpi:scale-110 group-hover/kpi:rotate-[-4deg]",
              TONES[tone]
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
