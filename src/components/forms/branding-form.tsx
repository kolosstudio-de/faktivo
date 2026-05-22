"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation } from "@tanstack/react-query"
import { ImageIcon, Loader2, PenTool, Stamp, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Settings } from "@/types/database.types"

type Field = "logo_url" | "signature_url" | "stamp_url"
type BucketId = "logos" | "signatures" | "stamps"

const ACCEPTED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const

interface SlotConfig {
  field: Field
  bucket: BucketId
  filenameStem: string
  maxMb: number
  preview: { width: number; height: number }
  isPublic: boolean
  Icon: React.ComponentType<{ className?: string }>
}

const SLOTS: ReadonlyArray<SlotConfig> = [
  {
    field: "logo_url",
    bucket: "logos",
    filenameStem: "logo",
    maxMb: 2,
    preview: { width: 160, height: 80 },
    isPublic: true,
    Icon: ImageIcon,
  },
  {
    field: "signature_url",
    bucket: "signatures",
    filenameStem: "signature",
    maxMb: 1,
    preview: { width: 200, height: 80 },
    isPublic: false,
    Icon: PenTool,
  },
  {
    field: "stamp_url",
    bucket: "stamps",
    filenameStem: "stamp",
    maxMb: 1,
    preview: { width: 120, height: 120 },
    isPublic: false,
    Icon: Stamp,
  },
]

interface Props {
  initial: Settings
}

export function BrandingForm({ initial }: Props) {
  const t = useTranslations("Settings")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brandingTitle")}</CardTitle>
        <CardDescription>{t("brandingHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        {SLOTS.map((slot) => (
          <BrandingSlot
            key={slot.field}
            slot={slot}
            initialUrl={initial[slot.field] as string | null}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface SlotProps {
  slot: SlotConfig
  initialUrl: string | null
}

function BrandingSlot({ slot, initialUrl }: SlotProps) {
  const t = useTranslations("Settings")
  const supabase = useSupabase()
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(initialUrl)
  const inputId = `branding-${slot.field}`
  const inputRef = React.useRef<HTMLInputElement>(null)

  const labelKey =
    slot.field === "logo_url"
      ? "logoLabel"
      : slot.field === "signature_url"
        ? "signatureLabel"
        : "stampLabel"
  const hintKey =
    slot.field === "logo_url"
      ? "logoHint"
      : slot.field === "signature_url"
        ? "signatureHint"
        : "stampHint"
  const emptyKey =
    slot.field === "logo_url"
      ? "noLogoYet"
      : slot.field === "signature_url"
        ? "noSignatureYet"
        : "noStampYet"

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const maxBytes = slot.maxMb * 1024 * 1024
      if (file.size > maxBytes) {
        throw new Error(
          t("fileTooLarge", { max: slot.maxMb })
        )
      }
      if (
        !ACCEPTED_MIMES.includes(
          file.type as (typeof ACCEPTED_MIMES)[number]
        )
      ) {
        throw new Error(t("wrongFileType"))
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase()
      const path = `${user.id}/${slot.filenameStem}-${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(slot.bucket)
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr

      let url: string
      if (slot.isPublic) {
        const { data } = supabase.storage.from(slot.bucket).getPublicUrl(path)
        url = data.publicUrl
      } else {
        const { data, error } = await supabase.storage
          .from(slot.bucket)
          .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year
        if (error || !data?.signedUrl) {
          throw error ?? new Error("Could not create signed URL")
        }
        url = data.signedUrl
      }

      const { error: updErr } = await supabase
        .from("settings")
        .update({ [slot.field]: url })
        .eq("user_id", user.id)
      if (updErr) throw updErr

      return url
    },
    onSuccess: (url) => {
      setCurrentUrl(url)
      toast.success(t("uploadSuccess"))
      if (inputRef.current) inputRef.current.value = ""
    },
    onError: (e: Error) => {
      toast.error(e.message || t("uploadError"))
      if (inputRef.current) inputRef.current.value = ""
    },
  })

  const removeMut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Best-effort: extract the path inside the bucket from current URL
      // and delete. We don't fail the entire op if delete fails — the row
      // update is the source of truth.
      if (currentUrl) {
        const m = currentUrl.match(
          new RegExp(`/${slot.bucket}/([^?]+)`)
        )
        if (m && m[1]) {
          const path = decodeURIComponent(m[1])
          await supabase.storage.from(slot.bucket).remove([path])
        }
      }

      const { error: updErr } = await supabase
        .from("settings")
        .update({ [slot.field]: null })
        .eq("user_id", user.id)
      if (updErr) throw updErr
    },
    onSuccess: () => {
      setCurrentUrl(null)
      toast.success(t("removeSuccess"))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMut.mutate(file)
  }

  const onRemove = () => {
    if (typeof window !== "undefined") {
      if (!window.confirm(t("removeConfirm"))) return
    }
    removeMut.mutate()
  }

  const isWorking = uploadMut.isPending || removeMut.isPending

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <slot.Icon className="size-4" />
        <span>{t(labelKey)}</span>
      </div>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        {t(hintKey)}
      </p>
      <div
        className="bg-muted/30 flex items-center justify-center overflow-hidden rounded-xl border border-dashed"
        style={{
          width: slot.preview.width,
          height: slot.preview.height,
        }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={t(labelKey)}
            width={slot.preview.width}
            height={slot.preview.height}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-1 text-[10px]">
            <Upload className="size-4" />
            <span>{t(emptyKey)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIMES.join(",")}
          className="hidden"
          onChange={onFileChange}
          disabled={isWorking}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          asChild
          disabled={isWorking}
        >
          <label htmlFor={inputId} className="cursor-pointer">
            {uploadMut.isPending ? (
              <Loader2 className="mr-1.5 size-3 animate-spin" />
            ) : (
              <Upload className="mr-1.5 size-3" />
            )}
            {currentUrl ? t("replaceButton") : t("uploadButton")}
          </label>
        </Button>
        {currentUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={isWorking}
          >
            {removeMut.isPending ? (
              <Loader2 className="mr-1.5 size-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 size-3" />
            )}
            {t("removeButton")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
