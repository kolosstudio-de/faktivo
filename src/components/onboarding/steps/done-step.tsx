import { CheckCircle2, FileText, Receipt, Users } from "lucide-react"

import type { OnboardingData } from "@/lib/validators/onboarding"

interface Props {
  data: OnboardingData
}

export function DoneStep({ data }: Props) {
  const name = data.first_name || "da"
  return (
    <div className="grid gap-6 text-center">
      <div className="mx-auto">
        <div className="grid size-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
      </div>

      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Alles bereit, {name} 🎉
        </h1>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          Dein Profil ist eingerichtet — auf Basis deiner Angaben ist alles DSGVO- & GoBD-konform konfiguriert.
        </p>
      </div>

      <div className="bg-muted/50 mx-auto grid max-w-sm gap-3 rounded-2xl border p-5 text-left text-sm">
        {[
          { icon: Users, label: "Kunden anlegen" },
          { icon: FileText, label: "Angebote schreiben" },
          { icon: Receipt, label: "Rechnungen rechtskonform versenden" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="text-primary size-4 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {data.receives_buergergeld ? (
        <div className="bg-blue-500/10 text-blue-800 dark:text-blue-300 mx-auto max-w-sm rounded-xl border border-blue-500/20 p-3 text-xs">
          Jobcenter-Modul ist aktiv — du findest es im Menü unter <b>Berichte → Jobcenter</b>.
        </div>
      ) : null}

      {data.is_ksk_abgabepflichtig ? (
        <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 mx-auto max-w-sm rounded-xl border border-amber-500/20 p-3 text-xs">
          KSK-Modus ist aktiv — deine Ausgaben sind ggf. KSK-abgabepflichtig (§24 KSVG).
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Klicke auf <b>„Jetzt starten&ldquo;</b> — dein Dashboard wartet.
      </p>
    </div>
  )
}
