"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  ArchiveRestore,
  Building2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { Link } from "@/i18n/navigation"
import type { Client } from "@/types/database.types"
import { clientDisplayName, addressLine } from "@/lib/utils/client-display"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientForm } from "@/components/forms/client-form"
import { cn } from "@/lib/utils"

interface Props {
  initial: Client[]
}

export function ClientsTable({ initial }: Props) {
  const t = useTranslations("Clients")
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const [query, setQuery] = React.useState("")
  const [showArchived, setShowArchived] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Client | null>(null)

  const { data = initial } = useQuery({
    queryKey: ["clients", { showArchived }],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").order("created_at", { ascending: false })
      if (!showArchived) q = q.is("archived_at", null)
      const { data, error } = await q
      if (error) throw error
      return data as Client[]
    },
    initialData: initial,
  })

  const archiveMut = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("clients")
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Aktualisiert")
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return data
    return data.filter((c) => {
      const name = clientDisplayName(c).toLowerCase()
      const hay = [name, c.email, c.address?.city, c.ust_id, c.tax_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [data, query])

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "shrink-0",
            showArchived && "bg-muted text-foreground"
          )}
          onClick={() => setShowArchived((v) => !v)}
        >
          <Archive />
          Archiv
        </Button>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o)
            if (!o) setEditing(null)
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus />
              {t("new")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? t("open") : t("new")}</DialogTitle>
              <DialogDescription>
                Pflichtfelder ergeben sich aus dem Typ (Unternehmen ↔ Privatperson).
              </DialogDescription>
            </DialogHeader>
            <ClientForm
              initial={editing}
              onSuccess={() => {
                setDialogOpen(false)
                setEditing(null)
              }}
              onCancel={() => {
                setDialogOpen(false)
                setEditing(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border/50 bg-card grid place-items-center rounded-2xl border border-dashed py-20 text-center">
          <div className="text-muted-foreground text-sm">{t("empty")}</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("type")}</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Adresse</th>
                <th className="px-4 py-3 text-left font-medium">{t("email")}</th>
                <th className="px-4 py-3 text-left font-medium">USt-IdNr.</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={cn(
                    "hover:bg-muted/40 border-t transition-colors",
                    c.archived_at && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3">
                    {c.type === "company" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Building2 className="size-3" />
                        {t("typeCompany")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <UserIcon className="size-3" />
                        {t("typePerson")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {clientDisplayName(c)}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {addressLine(c.address as { zip?: string; city?: string; country?: string } | null)}
                  </td>
                  <td className="px-4 py-3 text-xs">{c.email ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {c.ust_id ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil />
                          {t("open")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.archived_at ? (
                          <DropdownMenuItem
                            onClick={() =>
                              archiveMut.mutate({ id: c.id, archive: false })
                            }
                          >
                            <ArchiveRestore />
                            {t("restore")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              archiveMut.mutate({ id: c.id, archive: true })
                            }
                          >
                            <Archive />
                            {t("archive")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
