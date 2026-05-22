"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { FileCheck2, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  currentPath: string
  onChange: (path: string) => void
}

const MAX_SIZE_MB = 10
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic"

export function BelegUpload({ currentPath, onChange }: Props) {
  const supabase = useSupabase()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Datei zu groß (max ${MAX_SIZE_MB} MB)`)
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${user.id}/belege/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type })
      if (error) throw error

      return path
    },
    onSuccess: (path) => {
      onChange(path)
      toast.success("Beleg hochgeladen")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clear = () => {
    onChange("")
    if (inputRef.current) inputRef.current.value = ""
  }

  if (currentPath) {
    const filename = currentPath.split("/").pop() ?? "beleg"
    return (
      <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <div className="flex items-center gap-2 truncate">
          <FileCheck2 className="text-primary size-4 shrink-0" />
          <span className="truncate">{filename}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={async () => {
              const { data } = await supabase.storage
                .from("attachments")
                .createSignedUrl(currentPath, 60 * 5)
              if (data?.signedUrl) window.open(data.signedUrl, "_blank")
            }}
          >
            Ansehen
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="size-7"
            onClick={clear}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        disabled={uploadMut.isPending}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadMut.mutate(file)
        }}
        className="cursor-pointer"
      />
      <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
        {uploadMut.isPending ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Lade hoch …
          </>
        ) : (
          <>
            <Upload className="size-3" />
            PDF oder Bild, max {MAX_SIZE_MB} MB · GoBD-konform archiviert
          </>
        )}
      </p>
    </div>
  )
}
