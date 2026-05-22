/**
 * Client-side login rate-limiter.
 *
 * Why this exists:
 *   Supabase Auth has its own server-side rate limits, but we want a UX
 *   shield that disables the form locally and shows a countdown when a
 *   user (or attacker) hammers the password field.
 *
 *   Stored in `localStorage` per-email so switching emails doesn't lock
 *   the whole browser. Per spec: max 5 attempts per 5-minute window.
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const STORAGE_PREFIX = "faktivo:auth:rl:"

interface RateState {
  attempts: number[] // unix-ms timestamps
}

function keyFor(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const probe = "__faktivo_probe__"
    window.localStorage.setItem(probe, "1")
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function readState(email: string): RateState {
  if (!isLocalStorageAvailable()) return { attempts: [] }
  try {
    const raw = window.localStorage.getItem(keyFor(email))
    if (!raw) return { attempts: [] }
    const parsed = JSON.parse(raw) as RateState
    if (!parsed?.attempts || !Array.isArray(parsed.attempts)) {
      return { attempts: [] }
    }
    // Prune anything outside the window already, so callers don't have to.
    const now = Date.now()
    return {
      attempts: parsed.attempts.filter((t) => now - t < WINDOW_MS),
    }
  } catch {
    return { attempts: [] }
  }
}

function writeState(email: string, state: RateState): void {
  if (!isLocalStorageAvailable()) return
  try {
    window.localStorage.setItem(keyFor(email), JSON.stringify(state))
  } catch {
    // quota or private-mode — silently degrade
  }
}

/**
 * Returns the cooldown status for the given email.
 *
 *   - `allowed: true`  → user may attempt sign-in
 *   - `allowed: false` → form should be disabled; `secondsRemaining` is how
 *                        long until the oldest attempt falls out of the window
 */
export interface LoginRateStatus {
  allowed: boolean
  remainingAttempts: number
  secondsRemaining: number
}

export function getLoginRateStatus(email: string): LoginRateStatus {
  if (!email.trim()) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      secondsRemaining: 0,
    }
  }
  const { attempts } = readState(email)
  const now = Date.now()
  if (attempts.length < MAX_ATTEMPTS) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - attempts.length,
      secondsRemaining: 0,
    }
  }
  // Oldest attempt determines when we unlock.
  const oldest = Math.min(...attempts)
  const msRemaining = WINDOW_MS - (now - oldest)
  return {
    allowed: false,
    remainingAttempts: 0,
    secondsRemaining: Math.max(1, Math.ceil(msRemaining / 1000)),
  }
}

/** Record a failed login attempt for this email. */
export function recordFailedLoginAttempt(email: string): LoginRateStatus {
  if (!email.trim()) return getLoginRateStatus(email)
  const { attempts } = readState(email)
  attempts.push(Date.now())
  writeState(email, { attempts })
  return getLoginRateStatus(email)
}

/** Wipe attempt history (call on successful login). */
export function clearLoginAttempts(email: string): void {
  if (!isLocalStorageAvailable() || !email.trim()) return
  try {
    window.localStorage.removeItem(keyFor(email))
  } catch {
    // ignore
  }
}

export const LOGIN_RATE_LIMIT = {
  MAX_ATTEMPTS,
  WINDOW_MS,
} as const
