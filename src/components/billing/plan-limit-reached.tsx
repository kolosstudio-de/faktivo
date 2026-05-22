import { Sparkles, FileText, Trash2 } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props {
  limit: number
  used: number
  draftCount: number
  /** Pro-Preis pro Monat, formatiert (z.B. "9,90 €"). */
  proPriceFormatted: string
}

/**
 * Server-Component: zeigt einen Upgrade-Block direkt auf /invoices/new
 * statt den Nutzer auf /billing zu redirecten. Vorteil: er sieht den
 * Kontext (warum gerade blockiert) und kann auch alte Drafts löschen,
 * die seinen Counter belasten.
 */
export function PlanLimitReached({
  limit,
  used,
  draftCount,
  proPriceFormatted,
}: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3" />
          Free-Tier
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Monats-Limit erreicht
        </h1>
        <p className="text-muted-foreground">
          Du hast in diesem Monat <b>{used}</b> von <b>{limit}</b>{" "}
          Rechnungen erstellt.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="text-primary mt-0.5 size-5" />
            <div className="flex-1">
              <h3 className="font-medium">
                Upgrade auf Pro — {proPriceFormatted} / Monat
              </h3>
              <p className="text-muted-foreground text-sm">
                Unbegrenzt Rechnungen, Banking-Auto-Sync, 3-stufiges
                Mahnwesen, DATEV-Export, eigenes Logo.
              </p>
            </div>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link href="/billing">Jetzt upgraden</Link>
          </Button>
        </CardContent>
      </Card>

      {draftCount > 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="text-muted-foreground mt-0.5 size-5" />
              <div className="flex-1">
                <h3 className="font-medium">
                  Du hast {draftCount} offene {draftCount === 1 ? "Entwurf" : "Entwürfe"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  Entwürfe zählen zum Monats-Limit. Lösche, was du nicht
                  mehr brauchst — danach kannst du eine neue Rechnung anlegen.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/invoices?status=draft">
                <FileText className="size-4" />
                Entwürfe verwalten
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-center text-xs">
        Stornorechnungen zählen nicht zum Limit — sie sind Korrekturen
        bestehender Rechnungen.
      </p>
    </div>
  )
}
