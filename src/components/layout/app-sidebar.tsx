"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  BarChart3,
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LineChart as LineChartIcon,
  PieChart,
  Receipt,
  Repeat,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react"

import { Link, usePathname } from "@/i18n/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const tNav = useTranslations("Nav")
  const tApp = useTranslations("App")
  const tSidebar = useTranslations("Sidebar")
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="bg-foreground text-background grid size-9 shrink-0 place-items-center rounded-2xl text-base font-medium tracking-tight">
            F
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium tracking-tight">{tApp("name")}</span>
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              {tSidebar("appSubtitle")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard" />}
                  isActive={isActive("/dashboard")}
                  tooltip={tNav("dashboard")}
                >
                  <LayoutDashboard />
                  <span>{tNav("dashboard")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{tSidebar("groupClientsAndDocs")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/clients" />}
                  isActive={isActive("/clients")}
                  tooltip={tNav("clients")}
                >
                  <Users />
                  <span>{tNav("clients")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/quotes" />}
                  isActive={isActive("/quotes")}
                  tooltip={tNav("quotes")}
                >
                  <FileText />
                  <span>{tNav("quotes")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/invoices" />}
                  isActive={isActive("/invoices")}
                  tooltip={tNav("invoices")}
                >
                  <Receipt />
                  <span>{tNav("invoices")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{tNav("finances")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={tNav("business")}>
                  <Building2 />
                  <span>{tNav("business")}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link href="/finances/business/income" />}
                      isActive={isActive("/finances/business/income")}
                    >
                      <TrendingUp className="text-emerald-500" />
                      <span>{tNav("income")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link href="/finances/business/expenses" />}
                      isActive={isActive("/finances/business/expenses")}
                    >
                      <TrendingDown className="text-rose-500" />
                      <span>{tNav("expenses")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton tooltip={tNav("personal")}>
                  <Wallet />
                  <span>{tNav("personal")}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link href="/finances/personal/income" />}
                      isActive={isActive("/finances/personal/income")}
                    >
                      <TrendingUp className="text-emerald-500" />
                      <span>{tNav("income")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link href="/finances/personal/expenses" />}
                      isActive={isActive("/finances/personal/expenses")}
                    >
                      <TrendingDown className="text-rose-500" />
                      <span>{tNav("expenses")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{tNav("reports")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/analytics" />}
                  isActive={isActive("/analytics")}
                  tooltip={tSidebar("analytics")}
                >
                  <LineChartIcon />
                  <span>{tSidebar("analytics")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/finances/categories" />}
                  isActive={isActive("/finances/categories")}
                  tooltip={tSidebar("categories")}
                >
                  <PieChart />
                  <span>{tSidebar("categories")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/banking" />}
                  isActive={
                    pathname === "/banking" ||
                    (pathname.startsWith("/banking/") &&
                      !pathname.startsWith("/banking/accounts"))
                  }
                  tooltip={tSidebar("bankImport")}
                >
                  <Upload />
                  <span>{tSidebar("bankImport")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/banking/accounts" />}
                  isActive={isActive("/banking/accounts")}
                  tooltip={tSidebar("bankAccounts")}
                >
                  <Wallet />
                  <span>{tSidebar("bankAccounts")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/finances/abos" />}
                  isActive={isActive("/finances/abos")}
                  tooltip={tSidebar("contractsAndSubs")}
                >
                  <Repeat />
                  <span>{tSidebar("contractsAndSubs")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/reports/jobcenter" />}
                  isActive={isActive("/reports/jobcenter")}
                  tooltip={tNav("jobcenter")}
                >
                  <BarChart3 />
                  <span>{tNav("jobcenter")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/reports/export" />}
                  isActive={isActive("/reports/export")}
                  tooltip={tNav("export")}
                >
                  <FileSpreadsheet />
                  <span>{tNav("export")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/reports/eur" />}
                  isActive={isActive("/reports/eur")}
                  tooltip={tNav("eur")}
                >
                  <FileSpreadsheet />
                  <span>{tNav("eur")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/billing" />}
                  isActive={isActive("/billing")}
                  tooltip={tSidebar("subscriptionAndPlan")}
                >
                  <CreditCard />
                  <span>{tSidebar("subscriptionAndPlan")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={isActive("/settings") && !pathname.endsWith("/privacy")}
                  tooltip={tNav("settings")}
                >
                  <Settings />
                  <span>{tNav("settings")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings/privacy" />}
                  isActive={isActive("/settings/privacy")}
                  tooltip={tSidebar("privacyTooltip")}
                >
                  <Shield />
                  <span>{tSidebar("privacy")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
