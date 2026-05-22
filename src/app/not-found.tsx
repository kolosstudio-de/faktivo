import Link from "next/link"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  return (
    <html lang="de">
      <body className="bg-background text-foreground font-sans antialiased">
        <div className="bg-muted/20 relative min-h-dvh overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="bg-primary/10 absolute -top-40 -right-20 size-[32rem] rounded-full blur-3xl" />
            <div className="bg-chart-2/10 absolute top-1/3 -left-40 size-[32rem] rounded-full blur-3xl" />
          </div>
          <div className="relative mx-auto grid min-h-dvh max-w-md place-items-center px-6">
            <div className="grid gap-6 text-center">
              <div className="mx-auto font-mono text-7xl font-bold tracking-tighter text-primary">
                404
              </div>
              <div className="grid gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Seite nicht gefunden
                </h1>
                <p className="text-muted-foreground text-sm">
                  Die gesuchte Seite existiert nicht oder wurde verschoben.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/de"
                  className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm transition hover:opacity-90"
                >
                  <Home className="size-4" />
                  Zur Startseite
                </Link>
                <Link
                  href="/de/dashboard"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  <ArrowLeft className="size-3" />
                  Zum Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
