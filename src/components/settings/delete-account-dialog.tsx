"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  locale: string
}

export function DeleteAccountDialog({ locale }: Props) {
  const t = useTranslations("Privacy")
  const [typed, setTyped] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const confirmToken = t("deleteConfirmToken")

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/privacy/delete", { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("deleteFailed"))
      }
    },
    onSuccess: () => {
      toast.success(t("deleteSuccess"))
      setTimeout(() => {
        window.location.href = `/${locale}`
      }, 800)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <Trash2 />
          {t("deleteButton")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmDescriptionPart1")}
            <b>{t("deleteConfirmDescriptionStrong")}</b>
            {t("deleteConfirmDescriptionPart2")}
            <b>{t("deleteConfirmDescriptionStrong2")}</b>
            {t("deleteConfirmDescriptionPart3")}
            <br />
            <br />
            {t("deleteConfirmTypePrefix")}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
              {confirmToken}
            </code>
            {t("deleteConfirmTypeSuffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="confirm-delete">{t("deleteConfirmLabel")}</Label>
          <Input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("deleteCancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMut.mutate()}
            disabled={typed !== confirmToken || deleteMut.isPending}
            className="bg-destructive text-destructive-foreground"
          >
            {deleteMut.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            {t("deleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
