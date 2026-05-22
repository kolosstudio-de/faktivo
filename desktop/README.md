# Faktivo Desktop App (macOS Apple Silicon)

Local-First-Architektur für deutsche Freelancer & Aufstocker. Alle Business-Daten bleiben auf dem Mac des Users — nur Login & Lizenz-Validierung gehen über unseren Cloud-Server.

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│  Cloud (Faktivo-Server)                                 │
│  ├── auth.users (email + password only)                 │
│  └── license_keys + machine_activations                 │
│                                                         │
│  /api/license/activate   /api/license/validate          │
│  /api/license/deactivate /api/license/status            │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ HTTPS, ~1× pro Tag
                         │ NICHTS Business-Daten
                         │
┌─────────────────────────────────────────────────────────┐
│  Faktivo.app (Tauri 2.0 + Rust + WebKit)                │
│  ├── Bundled Next.js standalone server (Port :3000)     │
│  ├── PGlite (Postgres → WASM, alle 9 Migrationen)       │
│  └── ~/Library/Application Support/Faktivo/             │
│       ├── db/                                           │
│       ├── belege/                                       │
│       ├── pdfs/                                         │
│       └── license.json                                  │
└─────────────────────────────────────────────────────────┘
```

## Voraussetzungen

- macOS 11+ Big Sur (für Apple Silicon ab macOS 11)
- Rust toolchain (`brew install rustup-init && rustup-init`)
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20+ (parent project)

## Setup (Entwicklung)

```bash
# Im Repo-Root
npm install

# In desktop/ Ordner
cd desktop
npm install

# Tauri-CLI installieren (einmalig)
cargo install tauri-cli --version "^2"

# App im Dev-Mode starten (öffnet macOS Fenster mit Hot-Reload)
npm run dev
```

## Build (.dmg)

```bash
cd desktop
npm run build:dmg
```

Output: `desktop/src-tauri/target/release/bundle/dmg/Faktivo_0.1.0_aarch64.dmg`

⚠️ **Apple Notarization**: Für Distribution an Endkunden muss das `.dmg` notarisiert werden. Das benötigt einen kostenpflichtigen Apple Developer Account ($99 / Jahr).

```bash
# Mit Notarization (in tauri.conf.json signingIdentity setzen):
xcrun notarytool submit "Faktivo_0.1.0_aarch64.dmg" \
    --keychain-profile "AC_PASSWORD" \
    --wait
```

## Phases noch zu erledigen

- [x] Phase 1: Cloud License System (DB + API + UI)
- [x] Phase 2: Tauri Scaffold + Rust Commands (machine_fingerprint, app_info)
- [ ] Phase 3: PGlite-Integration als Local DB Backend
- [ ] Phase 4: Auto-Updater + Code-Signing + Notarization
- [ ] Phase 5: Backup/Restore via iCloud-Drive

## Datenschutz

Diese App ist Privacy-by-Design:

✅ Wir sehen NIE: Rechnungen, Klienten, Bank-CSV, Belege, Beträge.
✅ Wir sehen NUR: Email-Adresse beim Login + Lizenz-Status.
✅ Alle Business-Daten verlassen niemals deinen Mac.
✅ DSGVO Art. 25 (Privacy by Design / by Default) erfüllt.

## Lizenz-Modell

- **Trial**: 30 Tage frei nach Sign-up. 1 Gerät.
- **Free**: 5 Rechnungen/Monat, 1 Gerät, kein Banking-Import.
- **Pro**: €5,90/Monat, 2 Geräte.
- **Business**: €19,90/Monat, 5 Geräte, alle Features.

Lizenz-Schlüssel-Format: `FAK-XXXX-XXXX-XXXX-XXXX` (Crockford Base32)
