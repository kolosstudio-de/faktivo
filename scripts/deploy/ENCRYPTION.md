# End-to-End Encryption — technische Roadmap

Wenn du verkaufen willst: «Wir sehen nicht mal selbst eure Daten» — so geht's.

## Threat Model

| Wer kann was sehen | Heute | Mit E2E-Encryption |
|---|---|---|
| **Du als Betreiber** (DB-Admin) | Alles plaintext | Nur ciphertext + Metadaten (Datum, Betrag) |
| **Hacker mit DB-Dump** | Alles plaintext | Nur ciphertext (ohne Master-Key wertlos) |
| **DSGVO-Aufsicht / Polizei mit Beschlag** | Alles | Nur ciphertext |
| **User selbst (im Browser)** | Alles plaintext | Alles plaintext |

## Architektur

```
┌──────────────────────────────────────────────────────────┐
│ BROWSER (Client-Side)                                    │
│                                                          │
│  Login: email + password                                 │
│      │                                                    │
│      ▼                                                    │
│  Argon2id(password, salt=user_id) → master_key (256-bit) │
│      │                                                    │
│      ▼                                                    │
│  Vor JEDEM Save:                                         │
│    encrypted_vendor = AES-GCM(vendor, master_key, iv)    │
│    encrypted_iban   = AES-GCM(iban, master_key, iv)      │
│    encrypted_belege = AES-GCM(file_bytes, master_key, iv)│
│      │                                                    │
│      ▼                                                    │
│  POST /api/expense_entries                               │
│    { occurred_on: "2026-04-28",                          │
│      amount_cents: 6745,                                 │
│      vendor: "<base64-ciphertext>",   ← nicht lesbar     │
│      description: "<base64-ciphertext>" }                │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼ HTTPS
┌──────────────────────────────────────────────────────────┐
│ SERVER (Faktivo Cloud)                                   │
│                                                          │
│  expense_entries-Row:                                    │
│    id: uuid                                              │
│    user_id: uuid                                         │
│    occurred_on: 2026-04-28      ← plain (für queries)    │
│    amount_cents: 6745            ← plain (für SUM)       │
│    vendor: <ciphertext>          ← unlesbar              │
│    description: <ciphertext>     ← unlesbar              │
│                                                          │
│  ❌ Server kann NICHT entschlüsseln (no key)             │
│  ❌ DB-Dump = nutzlos für Angreifer                      │
│  ✅ SUM(amount_cents), GROUP BY occurred_on funktioniert │
└──────────────────────────────────────────────────────────┘
```

## Implementation-Plan (1-2 Wochen)

### Schritt 1: Crypto-Library auswählen
**Empfehlung**: `libsodium.js` (sodium-plus) oder Web Crypto API

```typescript
// src/lib/crypto/master-key.ts
import sodium from 'libsodium-wrappers'

export async function deriveMasterKey(password: string, userId: string) {
  await sodium.ready
  const salt = sodium.from_string(userId).slice(0, 16) // 16-byte salt
  return sodium.crypto_pwhash(
    32,              // 32-byte key
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
}

export async function encryptField(plaintext: string, masterKey: Uint8Array) {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    masterKey
  )
  // Format: <nonce-base64>.<ciphertext-base64>
  return `${sodium.to_base64(nonce)}.${sodium.to_base64(ct)}`
}

export async function decryptField(envelope: string, masterKey: Uint8Array) {
  const [nonceB64, ctB64] = envelope.split('.')
  const nonce = sodium.from_base64(nonceB64)
  const ct = sodium.from_base64(ctB64)
  const pt = sodium.crypto_secretbox_open_easy(ct, nonce, masterKey)
  return sodium.to_string(pt)
}
```

### Schritt 2: Master-Key in Browser-Memory halten

```typescript
// src/lib/crypto/key-store.ts
let masterKey: Uint8Array | null = null

export function setMasterKey(key: Uint8Array) {
  masterKey = key
  // Auto-clear nach 30min Inaktivität
  setTimeout(() => { masterKey = null }, 30 * 60 * 1000)
}

export function getMasterKey() {
  if (!masterKey) throw new Error('Locked — please re-enter password')
  return masterKey
}

export function lock() { masterKey = null }
```

Wichtig:
- Master-Key NIE in localStorage/sessionStorage (XSS-Risiko)
- NIE an Server senden
- Bei Login: derive → in Memory
- Bei Logout/Tab-close: weg

### Schritt 3: Encrypt vor jedem DB-Save

Verschlüsselte Felder festlegen:
```typescript
// src/lib/crypto/encrypted-fields.ts
export const ENCRYPTED_FIELDS = {
  expense_entries: ['vendor', 'description', 'category_label'],
  income_entries: ['source', 'description'],
  invoices: ['notes', 'internal_notes'],
  clients: ['email', 'phone', 'first_name', 'last_name', 'company_name', 'address'],
  bank_transactions: [
    'remittance_info', 'counterparty_name', 'counterparty_iban'
  ],
  belege: ['ocr_vendor', 'ocr_description', 'ocr_raw_jsonb'],
}
```

Wrapper für Supabase-Client:
```typescript
// src/lib/supabase/encrypted-client.ts
import { createClient } from '@supabase/supabase-js'
import { encryptField, decryptField } from '@/lib/crypto/master-key'
import { ENCRYPTED_FIELDS } from './encrypted-fields'

export function createEncryptedClient(url: string, key: string) {
  const raw = createClient(url, key)
  return {
    from(table: string) {
      const fields = ENCRYPTED_FIELDS[table] ?? []
      return {
        async insert(row: any) {
          const k = getMasterKey()
          const enc = { ...row }
          for (const f of fields) {
            if (enc[f] != null) enc[f] = await encryptField(enc[f], k)
          }
          return raw.from(table).insert(enc)
        },
        async select() {
          const k = getMasterKey()
          const { data, error } = await raw.from(table).select()
          if (error || !data) return { data, error }
          for (const row of data) {
            for (const f of fields) {
              if (row[f] != null) row[f] = await decryptField(row[f], k)
            }
          }
          return { data, error }
        },
        // ... update, delete
      }
    }
  }
}
```

### Schritt 4: Migration für existierende Daten

Beim ersten Login nach Encryption-Update:
```typescript
async function migrateExistingDataToEncrypted(masterKey: Uint8Array) {
  for (const table of Object.keys(ENCRYPTED_FIELDS)) {
    const { data: rows } = await rawClient.from(table).select()
    for (const row of rows) {
      const updates: any = {}
      for (const field of ENCRYPTED_FIELDS[table]) {
        if (row[field] && !looksEncrypted(row[field])) {
          updates[field] = await encryptField(row[field], masterKey)
        }
      }
      if (Object.keys(updates).length) {
        await rawClient.from(table).update(updates).eq('id', row.id)
      }
    }
  }
}

function looksEncrypted(s: string) {
  return /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(s)
}
```

### Schritt 5: Recovery-Phrase

Beim Sign-up:
```
"Hier ist deine Recovery-Phrase. Speichere sie SICHER (Manager wie 1Password).
Wenn du dein Passwort vergisst, sind ALLE deine Daten verloren — wir können
sie nicht wiederherstellen, weil wir den Schlüssel nie sehen."

[24-word BIP39-mnemonic, encoded master_key]
```

## Probleme + Lösungen

### Problem 1: Server-side AI-Klassifikation
Der Claude-AI-Endpoint (`/api/belege/ocr`, `ai-classifier.ts`) braucht **plaintext** — also können wir das nicht mehr server-side machen.

**Lösung**: AI-Calls vom Browser direkt an Anthropic API (mit user-eigenem ANTHROPIC_API_KEY) → user kontrolliert auch das.

### Problem 2: Email senden
`send-invoice.ts` braucht Klient-Email + Rechnung-Inhalt.

**Lösung A**: Email vom Browser via Mailto-Link (User klickt selbst Senden).
**Lösung B**: Resend von Browser direkt (per-user RESEND_API_KEY).

### Problem 3: PDF-Generierung
`@react-pdf/renderer` läuft heute server-side.

**Lösung**: PDF im Browser generieren (`@react-pdf/renderer` läuft auch im Browser).

### Problem 4: Backup
DB-Backups sind ciphertext — User kann nichts mit ihnen anfangen wenn er Mac wechselt.

**Lösung**: Recovery-Phrase. User schreibt 24 Wörter auf Papier → kann auf neuem Gerät Master-Key wiederherstellen.

## TL;DR

**Implementations-Aufwand**: 1-2 Wochen.
**Für 95% der Privacy**: Hybrid-Modell (Metadaten plain, Inhalte encrypted).
**Für 100% Privacy**: Volles E2E + alle AI/Email/PDF in Browser.

Du kannst das **schrittweise** machen:
1. Stufe 1 — heutiger Tunnel (kein E2E)
2. Stufe 2 — Vercel mit E2E-Hybrid (Metadaten plain)
3. Stufe 3 — Volle E2E (alles in Browser, Tauri-App)
