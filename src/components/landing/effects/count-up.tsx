"use client"

import * as React from "react"
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react"

/**
 * Animated number that counts up to `value` once it enters the viewport.
 * `format` lets callers pre-format (e.g. as currency, percentage). Reduced-
 * motion users get the final value rendered immediately.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toString(),
  className,
  duration = 1.2,
}: {
  value: number
  format?: (n: number) => string
  className?: string
  duration?: number
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const prefersReduced = useReducedMotion()

  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, {
    stiffness: 80,
    damping: 18,
    duration: duration * 1000,
  })
  const display = useTransform(spring, (n) => format(n))

  React.useEffect(() => {
    if (!inView) return
    if (prefersReduced) {
      motionValue.set(value)
    } else {
      motionValue.set(value)
    }
  }, [inView, value, motionValue, prefersReduced])

  if (prefersReduced) {
    return <span className={className}>{format(value)}</span>
  }

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}
