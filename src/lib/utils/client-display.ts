import type { Client } from "@/types/database.types"

/** Human-readable display name for a client (company name OR full name). */
export function clientDisplayName(client: Pick<Client, "type" | "company_name" | "first_name" | "last_name">): string {
  if (client.type === "company") {
    return client.company_name?.trim() || "—"
  }
  const parts = [client.first_name, client.last_name].filter(Boolean)
  return parts.join(" ") || "—"
}

/** One-line address summary for lists. */
export function addressLine(
  address: { zip?: string; city?: string; country?: string } | null | undefined
): string {
  if (!address) return ""
  const parts: string[] = []
  if (address.zip || address.city) {
    parts.push([address.zip, address.city].filter(Boolean).join(" "))
  }
  if (address.country && address.country !== "DE") parts.push(address.country)
  return parts.join(", ")
}
