"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react"

/**
 * Magnetic wrapper — element subtly drifts toward the cursor on hover.
 * Drop any clickable element inside and it will gain magnetic behaviour
 * without changing its existing styles.
 *
 *   <Magnetic strength={0.25}>
 *     <Link className="...">CTA</Link>
 *   </Magnetic>
 *
 * The wrapper is `inline-block` so it doesn't break layouts. Reduced-motion
 * users see no movement — the wrapper becomes a no-op.
 */
export function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: React.ReactNode
  strength?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const prefersReduced = useReducedMotion()

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Spring-smooth the cursor delta so it feels physical, not jerky.
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 })

  function onMouseMove(e: React.MouseEvent<HTMLSpanElement>) {
    if (prefersReduced || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    x.set(dx * strength)
    y.set(dy * strength)
  }

  function onMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ x: springX, y: springY }}
      className={className ?? "inline-block"}
    >
      {children}
    </motion.span>
  )
}
