"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error boundary:", error)
  }, [error])

  return (
    <html lang="de">
      <body>
        <div
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem",
            backgroundColor: "#f8fafc",
            fontFamily: "system-ui, sans-serif",
            color: "#0f172a",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              display: "grid",
              gap: "1rem",
              textAlign: "center",
            }}
          >
            <AlertTriangle
              size={48}
              color="#dc2626"
              style={{ margin: "0 auto" }}
            />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
              Ein Fehler ist aufgetreten
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
              Keine Daten gehen verloren — lade die Seite neu. Der Fehler wurde
              automatisch an uns gemeldet.
            </p>
            {error.digest ? (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                }}
              >
                Fehler-ID: {error.digest}
              </p>
            ) : null}
            <button
              onClick={reset}
              style={{
                margin: "0 auto",
                backgroundColor: "#0f766e",
                color: "white",
                border: 0,
                padding: "0.625rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <RefreshCw size={14} />
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
