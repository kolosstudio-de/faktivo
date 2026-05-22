"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category } from "@/types/database.types"

// Default color palette — same colors used in the existing breakdown donut
// so the new category visually fits in.
const COLORS: Array<{ name: string; hex: string }> = [
  { name: "Slate", hex: "#64748b" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Pink", hex: "#ec4899" },
]

interface Props {
  existingCategories: Pick<Category, "id" | "name" | "scope" | "kind">[]
}

export function NewCategoryDialog({ existingCategories }: Props) {
  const t = useTranslations("Categories")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = React.useMemo(() => createClient(), [])

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [scope, setScope] = React.useState<"business" | "personal">("business")
  const [kind, setKind] = React.useState<"income" | "expense">("expense")
  const [color, setColor] = React.useState<string>(COLORS[7].hex) // Emerald
  const [parentId, setParentId] = React.useState<string>("")

  // Reset state when opening for a fresh entry.
  React.useEffect(() => {
    if (!open) return
    setName("")
    setScope("business")
    setKind("expense")
    setColor(COLORS[7].hex)
    setParentId("")
  }, [open])

  const eligibleParents = existingCategories.filter(
    (c) => c.scope === scope && c.kind === kind
  )

  const createMut = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim()
      if (!trimmed) {
        throw new Error(t("newCategoryErrorEmpty"))
      }
      if (trimmed.length > 60) {
        throw new Error(t("newCategoryErrorTooLong"))
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("not authenticated")

      const { error } = await supabase.from("categories").insert({
        user_id: user.id,
        name: trimmed,
        scope,
        kind,
        color: color || null,
        parent_id: parentId ? parentId : null,
        is_jobcenter_relevant: scope === "business" && kind === "expense",
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success(t("newCategorySuccess"))
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      setOpen(false)
      // Refresh the server component so the new category appears in the donut.
      router.refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-4" />
          {t("newCategoryButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newCategoryTitle")}</DialogTitle>
          <DialogDescription>{t("newCategoryDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate()
          }}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">{t("newCategoryName")}</Label>
            <Input
              id="cat-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("newCategoryNamePlaceholder")}
              maxLength={60}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-scope">{t("scope")}</Label>
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as "business" | "personal")
                  setParentId("")
                }}
              >
                <SelectTrigger id="cat-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">{t("scopeBusiness")}</SelectItem>
                  <SelectItem value="personal">{t("scopePersonal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-kind">{t("kind")}</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v as "income" | "expense")
                  setParentId("")
                }}
              >
                <SelectTrigger id="cat-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t("kindExpense")}</SelectItem>
                  <SelectItem value="income">{t("kindIncome")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("newCategoryColor")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  aria-label={c.name}
                  className={
                    "size-7 rounded-full border-2 transition " +
                    (color === c.hex
                      ? "border-foreground scale-110 shadow"
                      : "border-transparent hover:scale-105")
                  }
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {eligibleParents.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="cat-parent">
                {t("newCategoryParentOptional")}
              </Label>
              <Select
                value={parentId}
                onValueChange={(v) => setParentId(v ?? "")}
              >
                <SelectTrigger id="cat-parent">
                  <SelectValue placeholder={t("newCategoryParentNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("newCategoryParentNone")}
                  </SelectItem>
                  {eligibleParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={createMut.isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("newCategorySubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
