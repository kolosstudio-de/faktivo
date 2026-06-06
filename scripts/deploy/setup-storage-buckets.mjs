#!/usr/bin/env node
/**
 * Faktivo Storage-Buckets-Setup
 *
 * Erstellt die 5 Storage-Buckets auf einem frischen Supabase-Cloud-Projekt
 * idempotent (bereits-existierende werden übersprungen, nichts überschrieben).
 *
 * Buckets:
 *   - belege      (private, Eingangs-Belege)
 *   - signatures  (private, E-Signaturen)
 *   - stamps      (private, Firmen-Stempel)
 *   - documents   (private, hochgeladene Original-Rechnungen)
 *   - public      (public,  Logo-Bilder die auf PDFs sichtbar sind)
 *
 * Usage:
 *   1. Erst Cloud-Supabase per setup-cloud-supabase.sh aufsetzen
 *   2. Env-Vars in .env.local setzen (NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE_KEY)
 *   3. node scripts/deploy/setup-storage-buckets.mjs
 *
 * NICHT für lokales Supabase-Dev — die Buckets dort werden über die
 * Migration `supabase/storage/buckets.sql` (falls vorhanden) angelegt;
 * dieses Skript ist für Cloud-Bootstrapping.
 *
 * Stand 2026-06-04
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

// ─── .env.local laden (für lokalen Lauf) ──────────────────────────────────
function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local")
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, "utf-8")
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key]) continue // existierende env-vars haben Vorrang
    let value = raw
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
loadEnvLocal()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!URL || !SERVICE_KEY) {
  console.error(
    "✗ Fehlende Env-Vars. Setze in .env.local oder Shell:\n" +
      "    NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co\n" +
      "    SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role, NICHT anon!)\n\n" +
      "  Die Keys findest du im Supabase-Dashboard unter Settings → API."
  )
  process.exit(1)
}

// Service-Role-Key umgeht RLS — exakt das, was wir für Admin-Bootstrap brauchen.
const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Bucket-Definitionen ──────────────────────────────────────────────────
//
// Limits sind defensiv: belege+documents nehmen PDFs (typisch ~200 KB, max 10 MB
// für hochauflösende Foto-Belege via Handy). signatures+stamps sind kleine PNGs.
// Public-Logos auch klein. Damit verhindern wir, dass ein einzelner Upload das
// Free-Tier-Storage-Quota anknabbert.
const BUCKETS = [
  {
    id: "belege",
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/pdf",
    ],
    purpose: "Eingangs-Belege (Quittungen, Lieferanten-Rechnungen)",
  },
  {
    id: "signatures",
    public: false,
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ["image/png", "image/svg+xml"],
    purpose: "E-Signaturen für Rechnungs-PDFs",
  },
  {
    id: "stamps",
    public: false,
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ["image/png", "image/svg+xml"],
    purpose: "Firmen-Stempel für Rechnungs-PDFs",
  },
  {
    id: "documents",
    public: false,
    fileSizeLimit: 20 * 1024 * 1024, // 20 MB (historische Mehrseiter-PDFs)
    allowedMimeTypes: ["application/pdf"],
    purpose: "Hochgeladene Original-Rechnungen (Import vor Faktivo-Nutzung)",
  },
  {
    id: "public",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ],
    purpose: "Logo-Bilder (auf PDFs + Public-Profile sichtbar)",
  },
]

// ─── Bestehende Buckets holen ─────────────────────────────────────────────
console.log(`▸ Verbinde zu ${URL} …`)
const { data: existing, error: listError } = await supabase.storage.listBuckets()
if (listError) {
  console.error(`✗ Fehler beim Auflisten existierender Buckets:`, listError.message)
  console.error(
    "  → Häufigste Ursache: SUPABASE_SERVICE_ROLE_KEY ist falsch (z. B. anon statt service)."
  )
  process.exit(2)
}
const existingIds = new Set((existing ?? []).map((b) => b.id))
console.log(`▸ ${existingIds.size} Buckets bereits vorhanden`)

// ─── Anlegen, was fehlt ───────────────────────────────────────────────────
let created = 0
let skipped = 0
let failed = 0

for (const bucket of BUCKETS) {
  if (existingIds.has(bucket.id)) {
    console.log(`✓ ${bucket.id.padEnd(12)} existiert bereits — skip`)
    skipped++
    continue
  }

  const { error } = await supabase.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.fileSizeLimit,
    allowedMimeTypes: bucket.allowedMimeTypes,
  })

  if (error) {
    console.error(`✗ ${bucket.id.padEnd(12)} FAILED: ${error.message}`)
    failed++
    continue
  }

  console.log(
    `✓ ${bucket.id.padEnd(12)} created (${bucket.public ? "PUBLIC" : "private"}, ` +
      `≤${Math.round(bucket.fileSizeLimit / 1024 / 1024)} MB, ${bucket.allowedMimeTypes.length} mime-types)`
  )
  created++
}

console.log("")
console.log(`▸ Summary: ${created} created, ${skipped} skipped, ${failed} failed`)

if (failed > 0) {
  console.error(
    "\n⚠ Mindestens ein Bucket konnte nicht erstellt werden — check manuell auf"
  )
  console.error(`  ${URL.replace(/\/$/, "")}/dashboard → Storage → Buckets`)
  process.exit(3)
}

console.log("")
console.log("✓ Storage-Buckets fertig. Faktivo ist bereit für File-Uploads.")
console.log("")
console.log("  Optional: RLS-Policies pro Bucket setzen, falls du Storage")
console.log("  zwischen Usern strikt isolierst (Standard: user_id-Prefix per")
console.log("  upload-Pfad reicht für die meisten Fälle). Siehe")
console.log("  https://supabase.com/docs/guides/storage/security/access-control")
