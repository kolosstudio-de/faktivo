#!/usr/bin/env node
/**
 * Generiert das Apple-Client-Secret-JWT für „Sign in with Apple".
 *
 * Usage:
 *   node scripts/deploy/apple-jwt.mjs \
 *     --team-id   ABCDE12345 \
 *     --key-id    XYZAB67890 \
 *     --client-id digital.kolos.faktivo.web \
 *     --p8        ./AuthKey_XYZAB67890.p8
 *
 * → druckt das JWT (gültig 6 Monate). In SUPABASE_AUTH_EXTERNAL_APPLE_SECRET kopieren.
 *
 * Requires: `npm i -D jsonwebtoken` (ist bereits in dev-deps).
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const jwt = require("jsonwebtoken")

function arg(flag) {
  const i = process.argv.indexOf(flag)
  if (i === -1 || i === process.argv.length - 1) {
    throw new Error(`Missing required argument: ${flag}`)
  }
  return process.argv[i + 1]
}

const teamId = arg("--team-id")
const keyId = arg("--key-id")
const clientId = arg("--client-id")
const p8Path = path.resolve(arg("--p8"))

if (!fs.existsSync(p8Path)) {
  console.error(`❌ .p8 file not found: ${p8Path}`)
  process.exit(1)
}

const privateKey = fs.readFileSync(p8Path, "utf-8")
const now = Math.floor(Date.now() / 1000)
const sixMonths = 60 * 60 * 24 * 180 // Apple-Maximum: 6 Monate

const token = jwt.sign(
  {
    iss: teamId,
    iat: now,
    exp: now + sixMonths,
    aud: "https://appleid.apple.com",
    sub: clientId,
  },
  privateKey,
  {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: keyId,
    },
  }
)

const expiresAt = new Date((now + sixMonths) * 1000)
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("  Apple Sign-In Client Secret JWT generated")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log(`  Team ID:      ${teamId}`)
console.log(`  Key ID:       ${keyId}`)
console.log(`  Client ID:    ${clientId}`)
console.log(`  Expires at:   ${expiresAt.toISOString()}  (in 6 months)`)
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
console.log("Paste this into SUPABASE_AUTH_EXTERNAL_APPLE_SECRET:\n")
console.log(token)
console.log("\n⚠️  Calendar reminder: re-run this script before", expiresAt.toLocaleDateString("de-DE"))
