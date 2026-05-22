"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  ChevronDown,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Sun,
  User,
} from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"

interface UserMenuProps {
  user: SupabaseUser
}

export function UserMenu({ user }: UserMenuProps) {
  const tNav = useTranslations("Nav")
  const tAuth = useTranslations("Auth")
  const { theme, resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()

  const initials = React.useMemo(() => {
    const email = user.email ?? ""
    return email.slice(0, 2).toUpperCase()
  }, [user.email])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success(tAuth("logoutSuccess"))
    router.replace("/login")
    router.refresh()
  }

  const setLocale = (loc: "de" | "en" | "ru" | "uk") => {
    // Set NEXT_LOCALE cookie so middleware/server-render uses the new locale
    document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    router.replace(pathname, { locale: loc })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 rounded-xl px-2 pl-2.5"
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-xs sm:inline">
            {user.email}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="text-muted-foreground flex items-center gap-2 px-1.5 py-1 text-xs">
          <User className="size-3.5" />
          <span className="truncate">{user.email}</span>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User />
            {tNav("settings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe />
            Sprache / Language
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup>
              <DropdownMenuRadioItem value="de" onClick={() => setLocale("de")}>
                Deutsch
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en" onClick={() => setLocale("en")}>
                English
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ru" onClick={() => setLocale("ru")}>
                Русский
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="uk" onClick={() => setLocale("uk")}>
                Українська
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme}>
              <DropdownMenuRadioItem value="light" onClick={() => setTheme("light")}>
                <Sun /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" onClick={() => setTheme("dark")}>
                <Moon /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" onClick={() => setTheme("system")}>
                <Monitor /> System
                {theme === "system" ? (
                  <span className="text-muted-foreground ml-auto text-[10px] uppercase">
                    {resolvedTheme}
                  </span>
                ) : null}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          {tNav("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
