"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ImportInvoiceDialog } from "./import-invoice-dialog"

interface Props {
  kind: "invoice" | "quote"
}

export function ImportButton({ kind }: Props) {
  const [open, setOpen] = React.useState(false)
  const label = kind === "invoice" ? "Alte importieren" : "Alte importieren"

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="size-3.5" />
        {label}
      </Button>
      <ImportInvoiceDialog kind={kind} open={open} onOpenChange={setOpen} />
    </>
  )
}
