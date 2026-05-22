"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Animated mesh gradient — Mercury "command center at twilight" vibe.
 * Two large, slowly-drifting blobs rendered as radial-gradient layers
 * with motion's animate prop. Pointer-events-none, sits behind content.
 *
 * The colors auto-adapt to theme via CSS-variables (we read --color-* tokens
 * through Tailwind classes so light + dark each get an appropriate mood).
 *
 * Reduced-motion: animation pauses, blobs settle in their starting position.
 */
export function MeshGradient({ className }: { className?: string }) {
  const prefersReduced = useReducedMotion()

  const drift = prefersReduced
    ? undefined
    : { duration: 18, ease: "easeInOut" as const, repeat: Infinity, repeatType: "mirror" as const }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {/* Layer 1 — emerald (brand) drift, top-right */}
      <motion.div
        className="bg-emerald-500/30 dark:bg-emerald-500/20 absolute -top-40 -right-32 size-[42rem] rounded-full blur-[120px]"
        initial={{ x: 0, y: 0, scale: 1 }}
        animate={prefersReduced ? undefined : { x: [-30, 60, -30], y: [-20, 40, -20], scale: [1, 1.15, 1] }}
        transition={drift}
      />
      {/* Layer 2 — Mercury Blue, bottom-left */}
      <motion.div
        className="bg-[#5266eb]/35 dark:bg-[#5266eb]/30 absolute -bottom-40 -left-32 size-[44rem] rounded-full blur-[120px]"
        initial={{ x: 0, y: 0, scale: 1 }}
        animate={prefersReduced ? undefined : { x: [40, -40, 40], y: [30, -30, 30], scale: [1.05, 0.95, 1.05] }}
        transition={drift ? { ...drift, duration: 22 } : undefined}
      />
      {/* Layer 3 — small accent (amber), centered, slow pulse */}
      <motion.div
        className="bg-amber-400/20 dark:bg-amber-300/15 absolute top-1/3 left-1/2 size-[24rem] -translate-x-1/2 rounded-full blur-[100px]"
        initial={{ scale: 0.85, opacity: 0.6 }}
        animate={prefersReduced ? undefined : { scale: [0.85, 1.1, 0.85], opacity: [0.55, 0.85, 0.55] }}
        transition={drift ? { ...drift, duration: 14 } : undefined}
      />
      {/* Subtle grain overlay — lifts the gradient out of "default web" territory */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
