"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"

const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
  },
}

const STAGGER_PARENT: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

/**
 * Reveal-on-scroll wrapper. Children fade up + un-blur when 20% of the
 * element enters the viewport. `once` defaults to true so the animation
 * doesn't replay on scroll-back.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const prefersReduced = useReducedMotion()

  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={VARIANTS}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Stagger container — every direct <RevealItem> child appears with a
 * sequential delay. Use for card grids and bullet lists.
 */
export function RevealStagger({
  children,
  className,
  amount = 0.15,
}: {
  children: React.ReactNode
  className?: string
  amount?: number
}) {
  const prefersReduced = useReducedMotion()

  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={STAGGER_PARENT}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const prefersReduced = useReducedMotion()

  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={VARIANTS}>
      {children}
    </motion.div>
  )
}
