import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  /** CTA-Button(s) — meist ein einzelner Link/Button. */
  action?: React.ReactNode
  className?: string
}

/**
 * Wiederverwendbarer Leerzustand für Listen (Clients, Quotes, Invoices…).
 *
 * Warum: eine leere Tabelle sieht aus wie ein Bug. Ein klares CTA mit Erklärung
 * konvertiert Erstnutzer 5-10× besser.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card/30 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="bg-muted/40 text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
