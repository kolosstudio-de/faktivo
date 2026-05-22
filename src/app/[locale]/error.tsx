"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("Common")
  useEffect(() => {
    console.error("Locale error boundary:", error)
  }, [error])

  return (
    <div className="bg-muted/20 min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6">
        <div className="grid gap-4 text-center">
          <div className="text-destructive mx-auto grid size-16 place-items-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("errorBoundaryTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("errorBoundaryDescription")}
          </p>
          {error.digest ? (
            <p className="text-muted-foreground font-mono text-xs">
              {t("errorBoundaryRef")}: {error.digest}
            </p>
          ) : null}
          <div className="flex items-center justify-center gap-2">
            <Button onClick={reset}>
              <RefreshCw />
              {t("errorBoundaryRetry")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
