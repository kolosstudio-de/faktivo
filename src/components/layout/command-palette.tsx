"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  BarChart3,
  Building2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type { Client, Invoice, Quote } from "@/types/database.types"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const supabase = useSupabase()
  const t = useTranslations("CommandPalette")

  // Cmd+K / Ctrl+K global shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const { data: clients = [] } = useQuery({
    queryKey: ["command-palette", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, type, company_name, first_name, last_name, email")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Pick<Client, "id" | "type" | "company_name" | "first_name" | "last_name" | "email">[]
    },
    enabled: open,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ["command-palette", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, total_cents, status, issue_date")
        .order("issue_date", { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Pick<Invoice, "id" | "number" | "total_cents" | "status" | "issue_date">[]
    },
    enabled: open,
  })

  const { data: quotes = [] } = useQuery({
    queryKey: ["command-palette", "quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, number, total_cents, status, issue_date")
        .order("issue_date", { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Pick<Quote, "id" | "number" | "total_cents" | "status" | "issue_date">[]
    },
    enabled: open,
  })

  const go = (href: string) => {
    setOpen(false)
    // Type-cast because href isn't in the generated typed-routes
    router.push(href as "/dashboard")
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-8 gap-2 px-2.5 text-xs text-muted-foreground md:inline-flex"
      >
        <Search className="size-3.5" />
        <span>{t("searchTrigger")}</span>
        <kbd className="bg-muted text-muted-foreground ml-2 rounded border px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("placeholder")} />
        <CommandList>
          <CommandEmpty>{t("empty")}</CommandEmpty>

          <CommandGroup heading={t("groupQuickActions")}>
            <CommandItem onSelect={() => go("/invoices/new")}>
              <Plus className="mr-2 size-4" />
              <span>{t("actionNewInvoice")}</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/quotes/new")}>
              <Plus className="mr-2 size-4" />
              <span>{t("actionNewQuote")}</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/clients")}>
              <Plus className="mr-2 size-4" />
              <span>{t("actionNewClient")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t("groupNavigation")}>
            <NavItem icon={LayoutDashboard} label={t("navDashboard")} onSelect={() => go("/dashboard")} />
            <NavItem icon={Users} label={t("navClients")} onSelect={() => go("/clients")} />
            <NavItem icon={FileText} label={t("navQuotes")} onSelect={() => go("/quotes")} />
            <NavItem icon={Receipt} label={t("navInvoices")} onSelect={() => go("/invoices")} />
            <NavItem icon={TrendingUp} label={t("navIncomeBusiness")} onSelect={() => go("/finances/business/income")} />
            <NavItem icon={TrendingDown} label={t("navExpensesBusiness")} onSelect={() => go("/finances/business/expenses")} />
            <NavItem icon={Wallet} label={t("navIncomePersonal")} onSelect={() => go("/finances/personal/income")} />
            <NavItem icon={Building2} label={t("navExpensesPersonal")} onSelect={() => go("/finances/personal/expenses")} />
            <NavItem icon={BarChart3} label={t("navJobcenterReport")} onSelect={() => go("/reports/jobcenter")} />
            <NavItem icon={FileSpreadsheet} label={t("navEur")} onSelect={() => go("/reports/eur")} />
            <NavItem icon={Download} label={t("navDatevExport")} onSelect={() => go("/reports/export")} />
            <NavItem icon={Settings} label={t("navSettings")} onSelect={() => go("/settings")} />
            <NavItem icon={Shield} label={t("navPrivacy")} onSelect={() => go("/settings/privacy")} />
            <NavItem icon={CreditCard} label={t("navBilling")} onSelect={() => go("/billing")} />
          </CommandGroup>

          {clients.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("groupClients")}>
                {clients.slice(0, 10).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`client ${clientDisplayName(c)} ${c.email ?? ""}`}
                    onSelect={() => go(`/de/clients/${c.id}`)}
                  >
                    <Users className="mr-2 size-4" />
                    <span className="truncate">{clientDisplayName(c)}</span>
                    {c.email ? (
                      <span className="text-muted-foreground ml-auto truncate text-xs">
                        {c.email}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {invoices.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("groupInvoices")}>
                {invoices.slice(0, 10).map((inv) => (
                  <CommandItem
                    key={inv.id}
                    value={`invoice ${inv.number ?? ""} ${inv.issue_date}`}
                    onSelect={() => go(`/de/invoices/${inv.id}`)}
                  >
                    <Receipt className="mr-2 size-4" />
                    <span className="font-mono text-xs">
                      {inv.number ?? "—"}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      · {inv.issue_date}
                    </span>
                    <span className="ml-auto font-mono tabular-nums text-xs">
                      {formatMoney(inv.total_cents)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {quotes.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("groupQuotes")}>
                {quotes.slice(0, 10).map((q) => (
                  <CommandItem
                    key={q.id}
                    value={`quote ${q.number ?? ""} ${q.issue_date}`}
                    onSelect={() => go(`/de/quotes/${q.id}`)}
                  >
                    <FileText className="mr-2 size-4" />
                    <span className="font-mono text-xs">
                      {q.number ?? "—"}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      · {q.issue_date}
                    </span>
                    <span className="ml-auto font-mono tabular-nums text-xs">
                      {formatMoney(q.total_cents)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function NavItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onSelect: () => void
}) {
  return (
    <CommandItem onSelect={onSelect}>
      <Icon className="mr-2 size-4" />
      <span>{label}</span>
    </CommandItem>
  )
}
