/**
 * TrueLayer Webhook Signature Verification.
 *
 * Spec: https://docs.truelayer.com/docs/webhook-signatures
 *   - JWS-Compact mit ES512 (ECDSA P-521 / SHA-512)
 *   - Detached payload (RFC 7797): payload-Segment ist leer, der echte
 *     Body wird unter `${header}.${b64url(body)}.${signature}` rekonstruiert
 *   - Protected header: { alg: "ES512", kid: "<key-id>", tl_version: "2" }
 *   - JWKS: https://webhooks.truelayer.com/.well-known/jwks
 *
 * Replay-Protection: separat über event_id-Dedup im DB-Layer (siehe
 * 20260522000001_truelayer_webhook_event_id.sql).
 */

import { compactVerify, createRemoteJWKSet, decodeProtectedHeader } from "jose"

const DEFAULT_JWKS_URL = "https://webhooks.truelayer.com/.well-known/jwks"

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null
let cachedJwksUrl: string | null = null

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const url = process.env.TRUELAYER_WEBHOOK_JWKS_URL ?? DEFAULT_JWKS_URL
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url), {
      // 10 min cooldown zwischen JWKS-Refreshes — Key-Rotation passiert selten
      cooldownDuration: 10 * 60_000,
      // Cache TTL: 24h
      cacheMaxAge: 24 * 60 * 60_000,
    })
    cachedJwksUrl = url
  }
  return cachedJwks
}

export interface VerifySignatureResult {
  valid: boolean
  /** Header-Inhalt (kid, alg) — nützlich fürs Logging bei Fehlern. */
  headerInfo?: { kid?: string; alg?: string }
  /** Grund warum die Signatur invalid ist — nur für Debug/Logs. */
  reason?: string
}

/**
 * Verifiziert eine TrueLayer-Webhook-Signatur gegen den Roh-Body.
 *
 * Akzeptierte Header-Namen (case-insensitive): `Tl-Signature`, `x-tl-signature`.
 * Bei `TRUELAYER_WEBHOOK_SKIP_SIG=1` (nur Dev!) wird die Prüfung übersprungen.
 */
export async function verifyTruelayerSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<VerifySignatureResult> {
  if (process.env.TRUELAYER_WEBHOOK_SKIP_SIG === "1") {
    return { valid: true, reason: "skipped (dev)" }
  }

  if (!signatureHeader) {
    return { valid: false, reason: "missing signature header" }
  }

  const parts = signatureHeader.split(".")
  if (parts.length !== 3) {
    return { valid: false, reason: "malformed JWS (expected 3 segments)" }
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  // Recover full JWS: bei detached payload (RFC 7797) ist encodedPayload leer,
  // wir fügen base64url(rawBody) ein.
  const bodyB64 = Buffer.from(rawBody, "utf8").toString("base64url")
  const fullJws =
    encodedPayload === ""
      ? `${encodedHeader}.${bodyB64}.${encodedSignature}`
      : signatureHeader

  let header: { kid?: string; alg?: string }
  try {
    header = decodeProtectedHeader(fullJws) as { kid?: string; alg?: string }
  } catch {
    return { valid: false, reason: "cannot decode protected header" }
  }

  if (!header.kid) {
    return { valid: false, reason: "missing kid", headerInfo: header }
  }
  if (header.alg !== "ES512") {
    return { valid: false, reason: `unexpected alg ${header.alg}`, headerInfo: header }
  }

  try {
    const { payload } = await compactVerify(fullJws, getJwks(), {
      algorithms: ["ES512"],
    })

    // Wenn der Payload eingebettet war (non-detached), muss er dem Body entsprechen.
    if (encodedPayload !== "" && Buffer.from(payload).toString("utf8") !== rawBody) {
      return {
        valid: false,
        reason: "embedded payload mismatch",
        headerInfo: header,
      }
    }

    return { valid: true, headerInfo: header }
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "jws verification failed",
      headerInfo: header,
    }
  }
}

/**
 * Extrahiert event_id aus TrueLayer-Payload für Replay-Dedup.
 * Bevorzugt das `Tl-Webhook-Id`-Header, fällt zurück auf `event_id` im Body.
 */
export function extractEventId(
  headerWebhookId: string | null,
  parsedPayload: { event_id?: string } | null,
): string | null {
  if (headerWebhookId && headerWebhookId.length > 0) return headerWebhookId
  if (parsedPayload?.event_id) return parsedPayload.event_id
  return null
}
