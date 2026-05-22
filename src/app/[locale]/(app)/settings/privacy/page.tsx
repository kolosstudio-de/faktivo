import { getTranslations, setRequestLocale } from "next-intl/server"
import { Database, Download, FileArchive, Shield, Trash2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog"
import { Link } from "@/i18n/navigation"

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Privacy" })

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <Shield className="mr-2 inline size-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4" /> {t("exportTitle")}
          </CardTitle>
          <CardDescription>{t("exportDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a
              href="/api/privacy/export"
              target="_blank"
              rel="noreferrer"
              download
            >
              <Download />
              {t("exportButton")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="size-4" /> {t("gobdTitle")}
          </CardTitle>
          <CardDescription>{t("gobdDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/privacy/gobd-audit" target="_blank" rel="noreferrer">
              <FileArchive />
              {t("gobdButton")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" /> {t("subprocessorsTitle")}
          </CardTitle>
          <CardDescription>{t("subprocessorsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/datenschutz/subprocessors">
              {t("subprocessorsButton")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> {t("deleteTitle")}
          </CardTitle>
          <CardDescription>{t("deleteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
