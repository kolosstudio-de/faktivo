"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import type { User } from "@supabase/supabase-js"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Link } from "@/i18n/navigation"

import { UserMenu } from "./user-menu"
import { CommandPalette } from "./command-palette"
import { KeyboardShortcuts } from "./keyboard-shortcuts"

interface TopBarProps {
  user: User
}

export function TopBar({ user }: TopBarProps) {
  const tInvoices = useTranslations("Invoices")

  return (
    <header className="bg-background/70 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <div className="flex-1">
        <CommandPalette />
      </div>
      <Button asChild size="sm" className="hidden sm:flex">
        <Link href="/invoices/new">
          <Plus />
          {tInvoices("new")}
        </Link>
      </Button>
      <Button asChild size="icon" variant="outline" className="sm:hidden">
        <Link href="/invoices/new" aria-label={tInvoices("new")}>
          <Plus />
        </Link>
      </Button>
      <UserMenu user={user} />
      <KeyboardShortcuts />
    </header>
  )
}
