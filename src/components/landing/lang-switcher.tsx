"use client"

import { Check, ChevronDown, Globe } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface Props {
  locale: string
}

/**
 * Sprachen-Switcher OHNE Flaggen — bewusst neutral, da russische Fahne
 * für ukrainische Nutzer:innen problematisch ist und umgekehrt.
 * Reine Buchstaben-Codes sind neutral und legal sicher.
 *
 * Implementierung: harter Reload via window.location, weil das
 * – die NEXT_LOCALE-Cookie korrekt setzt (nächstes Visit ohne URL-Prefix)
 * – die komplette React-Server-Tree neu lädt (Server-Components mit anderen Messages)
 * – nicht von next/router-Bugs in next-intl-edge-cases betroffen ist
 */
const LOCALES: { code: "de" | "en" | "uk" | "ru"; label: string; short: string }[] = [
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "en", label: "English", short: "EN" },
  { code: "uk", label: "Українська", short: "УК" },
  { code: "ru", label: "Русский", short: "РУ" },
]

const LOCALE_RE = /^\/(de|en|ru|uk)(?=\/|$)/

export function LangSwitcher({ locale }: Props) {
  const pathname = usePathname() // ← FULL pathname WITH locale prefix (next/navigation)
  const searchParams = useSearchParams()

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]

  const buildUrl = (code: string) => {
    const path = pathname ?? "/"
    // /de/login → /en/login   |   /de → /en   |   / → /en
    const replaced = LOCALE_RE.test(path)
      ? path.replace(LOCALE_RE, `/${code}`)
      : path === "/" || path === ""
        ? `/${code}`
        : `/${code}${path}`
    const qs = searchParams?.toString()
    return qs ? `${replaced}?${qs}` : replaced
  }

  const switchTo = (code: string) => {
    if (code === locale) return
    const url = buildUrl(code)
    // Setze die Cookie EXPLIZIT + Navigation als reine Side-Effects.
    // (React-Compiler-Regel deaktiviert: dies sind absichtliche Browser-APIs.)
    /* eslint-disable react-hooks/immutability */
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; samesite=lax`
    window.location.assign(url)
    /* eslint-enable react-hooks/immutability */
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5">
          <Globe className="size-3.5" />
          <span className="font-medium">{current.short}</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {LOCALES.map((l) => {
          const isActive = l.code === locale
          return (
            <DropdownMenuItem
              key={l.code}
              onClick={(e) => {
                e.preventDefault()
                switchTo(l.code)
              }}
              className={
                isActive
                  ? "bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary font-medium"
                  : ""
              }
            >
              <span
                className={
                  isActive
                    ? "text-primary mr-2 font-mono text-xs"
                    : "text-muted-foreground mr-2 font-mono text-xs"
                }
              >
                {l.short}
              </span>
              <span className="flex-1">{l.label}</span>
              {isActive ? <Check className="text-primary size-3.5" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
