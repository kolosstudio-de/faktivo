import { getTranslations, setRequestLocale } from "next-intl/server"
import { Download, FileSpreadsheet, Info, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function ExportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Export" })

  const currentYear = new Date().getFullYear()

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" />
            {t("datevTitle")}
          </CardTitle>
          <CardDescription>
            {t("datevDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="bg-muted/40 rounded-xl border p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">{t("contentLabel")}</p>
            <ul className="list-disc pl-5">
              <li>{t("datevContent1")}</li>
              <li>{t("datevContent2")}</li>
              <li>{t("datevContent3")}</li>
              <li>{t("datevContent4")}</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <a
                href={`/api/export/datev?from=${currentYear}-01-01&to=${currentYear}-12-31`}
                target="_blank"
                rel="noreferrer"
              >
                <Download />
                {t("datevDownload", { year: currentYear })}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`/api/export/datev?from=${currentYear - 1}-01-01&to=${currentYear - 1}-12-31`}
                target="_blank"
                rel="noreferrer"
              >
                <Download />
                {t("datevPrev", { year: currentYear - 1 })}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4 text-emerald-600 dark:text-emerald-400" />
            {t("stbTitle")}
          </CardTitle>
          <CardDescription>
            {t("stbDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-emerald-500/10 mb-3 rounded-xl border border-emerald-500/20 p-3 text-xs leading-relaxed">
            <p className="mb-1 font-medium">{t("stbContents")}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>
                <code className="font-mono">/rechnungen/</code> — {t("stbContent1")}
              </li>
              <li>
                <code className="font-mono">/belege/</code> — {t("stbContent2")}
              </li>
              <li>
                <code className="font-mono">/datev/</code> — {t("stbContent3")}
              </li>
              <li>
                <code className="font-mono">/eur/</code> — {t("stbContent4")}
              </li>
              <li>
                <code className="font-mono">/eks/</code> — {t("stbContent5")}
              </li>
              <li>
                <code className="font-mono">README.txt</code> — {t("stbContent6")}
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <a
                href={`/api/export/steuerberater-zip?year=${currentYear}`}
                target="_blank"
                rel="noreferrer"
              >
                <Package />
                {t("stbDownload", { year: currentYear })}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`/api/export/steuerberater-zip?year=${currentYear - 1}`}
                target="_blank"
                rel="noreferrer"
              >
                <Package />
                {t("stbPrev", { year: currentYear - 1 })}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-500/10 text-blue-800 dark:text-blue-300 flex items-start gap-2.5 rounded-xl border border-blue-500/20 p-3 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <p className="font-medium">{t("hintsTitle")}</p>
          <ul className="mt-1 list-disc pl-4">
            <li>{t("hint1")}</li>
            <li>{t("hint2")}</li>
            <li>{t("hint3")}</li>
            <li>{t("hint4")}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
