"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import { formatMoney } from "@/lib/money"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface Props {
  data: Array<{ month: string; revenue: number }>
}

const chartConfig = {
  revenue: {
    label: "Umsatz",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function RevenueChart({ data }: Props) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          tickFormatter={(v) =>
            new Intl.NumberFormat("de-DE", {
              notation: "compact",
              currency: "EUR",
              style: "currency",
              maximumFractionDigits: 0,
            }).format(Number(v) / 100)
          }
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => label as string}
              formatter={(v, name) => [formatMoney(Number(v)), String(name)]}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
