/**
 * Smoke-test all authenticated routes by simulating a logged-in browser
 * session via Supabase's password-grant + a real cookie jar maintained
 * across requests.
 *
 * Usage: node scripts/smoke-test-routes.mjs
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, "..", ".env.local")
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=", 2))
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const APP = "http://localhost:3000"

const EMAIL = "kolosvasiliysergeevich@gmail.com"
const PASSWORD = "Faktivo2026!"

const ROUTES = [
  "/de/dashboard",
  "/uk/dashboard",
  "/de/banking",
  "/de/banking/accounts",
  "/de/finances/business/expenses",
  "/de/finances/business/income",
  "/de/finances/personal/expenses",
  "/de/finances/personal/income",
  "/de/finances/categories",
  "/de/finances/abos",
  "/de/analytics",
  "/de/reports/jobcenter",
  "/de/reports/eur",
  "/de/reports/export",
  "/de/clients",
  "/de/quotes",
  "/de/invoices",
  "/de/settings",
  "/de/settings/privacy",
  "/de/billing",
]

// Login via the supabase-js client → it gives us the session.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
const { data: signInData, error } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})

if (error || !signInData.session) {
  console.error("Login failed:", error?.message ?? "no session")
  process.exit(1)
}
const { access_token, refresh_token } = signInData.session

// Build the SSR auth cookie. Supabase SSR encodes the session JSON in a
// single cookie split into chunks (base64-url, prefixed). Easier: split
// into the modern `sb-<project>-auth-token` cookie. We mimic the format
// the @supabase/ssr SDK uses.
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
// For localhost dev, projectRef is `127`. The SSR cookie name matches
// what the @supabase/ssr server client expects from getAll().
const sessionPayload = {
  access_token,
  refresh_token,
  expires_at: signInData.session.expires_at,
  expires_in: signInData.session.expires_in,
  token_type: "bearer",
  user: signInData.user,
}

const sessionB64 =
  "base64-" +
  Buffer.from(JSON.stringify(sessionPayload)).toString("base64")

// Chunk the cookie into ≤ 3072-byte segments (Supabase's SDK splits like this).
function chunkValue(value, chunkSize = 3072) {
  const chunks = []
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize))
  }
  return chunks
}
const chunks = chunkValue(sessionB64)
const cookieName = `sb-${projectRef}-auth-token`
const cookieHeader =
  chunks.length === 1
    ? `${cookieName}=${chunks[0]}`
    : chunks
        .map((chunk, idx) => `${cookieName}.${idx}=${chunk}`)
        .join("; ")

console.log("Cookie header length:", cookieHeader.length, "chunks:", chunks.length)

let pass = 0
let fail = 0
const results = []

for (const route of ROUTES) {
  try {
    const res = await fetch(`${APP}${route}`, {
      redirect: "manual",
      headers: {
        cookie: cookieHeader,
        accept: "text/html",
      },
    })
    const tag = res.status === 200 || (res.status >= 300 && res.status < 400) ? "OK " : "ERR"
    if (res.status >= 500) fail++
    else pass++
    results.push({ route, status: res.status, tag })
    console.log(`${tag} ${res.status} ${route}`)
  } catch (e) {
    fail++
    results.push({ route, status: 0, tag: "ERR", error: e.message })
    console.log(`ERR  -  ${route}  ${e.message}`)
  }
}

console.log(`\nSummary: ${pass} ok, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
