import Stripe from "stripe"

let stripeSingleton: Stripe | null = null

export function getStripe(): Stripe | null {
  if (stripeSingleton) return stripeSingleton
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  stripeSingleton = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "Kolos Digital Finanzen",
      version: "0.1.0",
    },
  })
  return stripeSingleton
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ""
