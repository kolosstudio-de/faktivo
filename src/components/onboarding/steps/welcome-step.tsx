import { CheckCircle2, Sparkles } from "lucide-react"

export function WelcomeStep() {
  return (
    <div className="grid gap-6 text-center">
      <div className="mx-auto">
        <div className="bg-primary/10 text-primary grid size-16 place-items-center rounded-2xl">
          <Sparkles className="size-8" />
        </div>
      </div>

      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Willkommen bei Faktivo 👋
        </h1>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          In 3 Minuten richten wir dein Business-Profil ein — mit allem was das
          deutsche Steuerrecht verlangt. Keine Sorge, du kannst alles später ändern.
        </p>
      </div>

      <div className="bg-muted/50 mx-auto grid max-w-sm gap-3 rounded-2xl border p-5 text-left text-sm">
        {[
          "Rechtsform & Branche",
          "§19 Kleinunternehmer · Steuernummer",
          "Anschrift & Bankverbindung",
          "Optional: Bürgergeld / Jobcenter",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle2 className="text-primary size-4 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        DSGVO-konform · Server in der EU (Frankfurt) · Keine Daten an US-Cloud
      </p>
    </div>
  )
}
