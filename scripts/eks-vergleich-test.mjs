/**
 * EKS-Vergleich sanity check:
 *
 * 1. Empty BWZ → page should render with empty-state CTA (text contains the
 *    setup hint).
 * 2. Set BWZ = 2025-08-01..2026-02-28, Bedarf = €1063, Stufe=1.
 * 3. Fetch the page again → expect non-empty Vergleich content.
 * 4. Revert.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dirname, "..", ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=", 2))
)
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const APP = "http://localhost:3000"

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, SUPABASE_ANON)

const EMAIL = "kolosvasiliysergeevich@gmail.com"
const PASSWORD = "Faktivo2026!"

const signIn = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
const userId = signIn.data.user.id
const session = signIn.data.session
console.log("USER:", userId)

// Build cookie
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
const sessionPayload = {
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  expires_in: session.expires_in,
  token_type: "bearer",
  user: signIn.data.user,
}
const sessionB64 =
  "base64-" + Buffer.from(JSON.stringify(sessionPayload)).toString("base64")
function chunk(v, n = 3072) {
  const out = []
  for (let i = 0; i < v.length; i += n) out.push(v.slice(i, i + n))
  return out
}
const chunks = chunk(sessionB64)
const cookieName = `sb-${projectRef}-auth-token`
const cookieHeader =
  chunks.length === 1
    ? `${cookieName}=${chunks[0]}`
    : chunks.map((c, i) => `${cookieName}.${i}=${c}`).join("; ")

async function snapshotSettings() {
  const { data } = await admin
    .from("settings")
    .select(
      "bewilligungszeitraum_start, bewilligungszeitraum_end, buergergeld_bedarf_monatlich_cents, regelbedarf_stufe, receives_buergergeld, has_minor_children"
    )
    .eq("user_id", userId)
    .single()
  return data
}

async function fetchPage(url) {
  const res = await fetch(`${APP}${url}`, {
    redirect: "manual",
    headers: { cookie: cookieHeader, accept: "text/html" },
  })
  const text = await res.text()
  return { status: res.status, text }
}

console.log("=== Phase 1: Empty BWZ ===")
const before = await snapshotSettings()
console.log("Settings BEFORE:", before)

const empty = await fetchPage("/uk/reports/jobcenter")
console.log("/uk/reports/jobcenter status:", empty.status)
console.log("Page bytes:", empty.text.length)
// Look for marker text indicating empty state
const hasEmptyHint =
  /Заповни|Налаштування|BWZ|Bewilligungszeitraum/i.test(empty.text)
console.log("Empty-state marker found:", hasEmptyHint)

console.log("=== Phase 2: Set BWZ ===")
await admin
  .from("settings")
  .update({
    bewilligungszeitraum_start: "2025-08-01",
    bewilligungszeitraum_end: "2026-02-28",
    buergergeld_bedarf_monatlich_cents: 106300,
    regelbedarf_stufe: 1,
    receives_buergergeld: true,
    has_minor_children: false,
  })
  .eq("user_id", userId)
const mid = await snapshotSettings()
console.log("Settings MID:", mid)

const populated = await fetchPage("/uk/reports/jobcenter")
console.log("/uk/reports/jobcenter status:", populated.status)
console.log("Page bytes:", populated.text.length)
// Look for monthly row markers
const monthsFound = (populated.text.match(/2025-(08|09|10|11|12)|2026-(01|02)/g) || []).length
console.log("Month-row substrings in HTML:", monthsFound)

console.log("=== Phase 3: Revert ===")
await admin
  .from("settings")
  .update({
    bewilligungszeitraum_start: before?.bewilligungszeitraum_start ?? null,
    bewilligungszeitraum_end: before?.bewilligungszeitraum_end ?? null,
    buergergeld_bedarf_monatlich_cents:
      before?.buergergeld_bedarf_monatlich_cents ?? null,
    regelbedarf_stufe: before?.regelbedarf_stufe ?? null,
    receives_buergergeld: before?.receives_buergergeld ?? false,
    has_minor_children: before?.has_minor_children ?? false,
  })
  .eq("user_id", userId)
const after = await snapshotSettings()
console.log("Settings AFTER (reverted):", after)

console.log("\nDONE.")
