# Faktivo — Style Reference

> Monochrome financial ledger by day, midnight command center by night —
> a high-contrast typographic system where the numbers do the talking,
> and a single accent guides every interaction.

**Themes:** light (Titan-inspired) + dark (Mercury-inspired)
**Font:** Geist Sans + Geist Mono (already in stack — zero migration cost)
**Signature shape:** pill buttons (full-radius), oversized card radii (32px)

---

## Theme Philosophy

Faktivo is software for people whose money depends on getting numbers right. The visual language treats that responsibility seriously: high contrast, tabular figures everywhere money appears, near-zero decorative chrome. But it is also software for solo entrepreneurs, freelancers, and Bürgergeld-Aufstocker who already feel overwhelmed by German bureaucracy — so the system softens its formality with generous spacing, oversized rounded corners, and warm off-white surfaces (light) or atmospheric near-black gradients (dark).

The result reads as a **financial ledger with human warmth** in light mode, and as a **command center at twilight** in dark mode. Both modes share the same skeletal structure (pill buttons, large card radii, mono numerics, single brand accent) so users never lose orientation when switching.

**One brand color across both themes:** Faktivo Emerald `#10b981` — used for success states, growth indicators, and brand identity. Each theme adds **one secondary action accent** for primary CTAs (Action Black in light, Mercury Blue in dark).

---

## Tokens — Colors

### Light theme (Titan-inspired)

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--background` | Page backgrounds, card surfaces |
| Off-White Sage | `#f3efeb` | `--muted` | Subtle card backgrounds, secondary sections, table row hover |
| Pebble | `#e9eaeb` | `--secondary` | Inert button backgrounds, faint dividers |
| Faded Stone | `#d8d3cc` | `--border` | Borders, ghost-button outlines, hairline dividers |
| Gunmetal Gray | `#615e5b` | `--muted-foreground` | Secondary text, helper labels, timestamps |
| Midnight Ink | `#111111` | `--foreground` | Primary text, max-contrast headlines |
| Action Black | `#000000` | `--primary` | Primary CTA buttons (high stakes — submit invoice, save) |
| Faktivo Emerald | `#10b981` | `--accent` / `--ring` | Brand identity, success states, growth indicators, focus rings |
| Highlight Amber | `#f59e0b` | `--chart-3` | Pending/attention indicators (overdue invoices) |
| Destructive Rose | `#dc2626` | `--destructive` | Delete, errors, critical warnings |

### Dark theme (Mercury-inspired)

| Name | Value | Token | Role |
|------|-------|-------|------|
| Deep Space | `#171721` | `--background` | Outermost page background — deepest layer |
| Midnight Slate | `#1e1e2a` | `--card` / `--popover` | Primary card and section surfaces |
| Graphite | `#272735` | `--secondary` / `--muted` | Elevated secondary surfaces, button backgrounds |
| Lead | `#70707d` | `--border` | Borders, dividers, subtle UI accents |
| Silver | `#c3c3cc` | `--muted-foreground` | Secondary text, footer copy |
| Starlight | `#ededf3` | `--foreground` | Primary text on dark surfaces |
| Mercury Blue | `#5266eb` | `--primary` | Primary CTA buttons — the single vivid accent in a muted palette |
| Faktivo Emerald | `#10b981` | `--accent` / `--ring` | Brand identity, success — same as light, preserves identity across themes |
| Highlight Amber | `#fbbf24` | `--chart-3` | Pending/attention indicators |
| Destructive Rose | `#f87171` | `--destructive` | Errors, critical warnings (lighter in dark mode for contrast) |

### Shared Charts Palette

Charts use a curated set distinct from semantic colors:
| Index | Light | Dark | Use |
|-------|-------|------|-----|
| chart-1 | `#10b981` (emerald) | `#10b981` | Revenue / income (positive) |
| chart-2 | `#5266eb` (Mercury blue) | `#7c8cf5` | Forecast / projection |
| chart-3 | `#f59e0b` (amber) | `#fbbf24` | Pending / overdue |
| chart-4 | `#a855f7` (violet) | `#c084fc` | Comparison / segments |
| chart-5 | `#ec4899` (pink) | `#f472b6` | Special category / highlight |

---

## Tokens — Typography

### Font Families (already in stack, zero install)

```ts
import { Geist, Geist_Mono } from "next/font/google"
```

| Family | Token | Role |
|--------|-------|------|
| Geist Sans | `--font-sans` | All UI: navigation, buttons, body, headlines |
| Geist Mono | `--font-mono` | All numbers (prices, dates, IDs, references) — `tabular-nums` enabled |

### Type Scale (Titan-inspired — weight through size, not heaviness)

| Role | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| display | 60px | 500 | 1.1 | Hero on landing / empty states |
| heading-xl | 48px | 500 | 1.1 | Major page titles (dashboard greeting) |
| heading-lg | 32px | 500 | 1.15 | Section headlines |
| heading | 24px | 500 | 1.2 | Card titles, panel headers |
| heading-sm | 20px | 500 | 1.3 | Subheadings, KPI value (mono) |
| body-lg | 18px | 400 | 1.5 | Lead paragraphs |
| body | 16px | 400 | 1.5 | Default body text |
| body-sm | 14px | 400 | 1.5 | Tables, secondary content |
| caption | 12px | 500 | 1.4 | Uppercase metadata labels (with `tracking-wide`) |

**Letter spacing:** `-0.02em` at display sizes (60px+), `-0.005em` at heading sizes (24-48px), `0` at body sizes. Headlines never go above weight 500 — authority comes from size, not stroke width.

### Numeric Treatment (critical for finance)

All money, dates, invoice numbers, and IDs use `font-mono tabular-nums`. This is non-negotiable: columns of numbers must align, and rounding artifacts in proportional fonts undermine trust.

```tsx
<span className="font-mono tabular-nums">{formatMoney(total)}</span>
```

---

## Tokens — Spacing & Shape

**Density:** comfortable. Numbers need room to breathe.
**Base unit:** 4px.
**Page max-width:** 1280px (matches current `max-w-7xl`).
**Section gap:** 24-32px (1.5rem-2rem).
**Card padding:** 20-24px.

### Border Radius (signature: bold, modern, pill-heavy)

| Element | Value | Tailwind | Rationale |
|---------|-------|----------|-----------|
| Buttons | full (9999px) | `rounded-full` | Titan/Mercury shared signature. Pills feel approachable yet decisive. |
| Badges | full (9999px) | `rounded-full` | Pill badges read as polished status chips. |
| Cards | 28px | `rounded-3xl` | Bold modern soft container. Distinct from buttons, distinct from inputs. |
| Inputs / Selects | 16px | `rounded-2xl` | Comfortable but not pill — keeps form rhythm. |
| Sidebar items | 16px | `rounded-2xl` | Matches inputs, soft visual continuity. |
| Tooltips / Popovers | 12px | `rounded-xl` | Smaller floating UI. |
| Tables / Lists | 0px | n/a | Tables don't get radius — rows go edge-to-edge of card. |

### Elevation

**Light mode:** Cards use a hairline ring (`ring-1 ring-foreground/8`) instead of shadow. Hover adds the faintest `bg-muted/50` lift on interactive cards. Modal/popover gets a soft, low-spread shadow `shadow-[0_8px_32px_-12px_rgba(0,0,0,0.12)]`.

**Dark mode:** Cards use background-color contrast for elevation (Deep Space → Midnight Slate → Graphite). No shadows — depth comes from layered surfaces. Hover lifts to `bg-card/80`. Modals add a subtle `shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]`.

**Universal rule:** never use `box-shadow` for primary surfaces. Surface contrast and border lines are the depth signals.

---

## Components

### Primary Button

```tsx
<Button>Speichern</Button>
```

**Light:** `bg-black text-white rounded-full hover:bg-black/85`
**Dark:** `bg-[#5266eb] text-white rounded-full hover:bg-[#5266eb]/90`

Pill shape across all sizes. Min height: 32px (xs) → 40px (lg). Generous horizontal padding (1.5x vertical).

### Secondary / Ghost / Outline Buttons

All pill-shaped. Outline uses `border-border` (Faded Stone in light, Lead in dark) with transparent background. Ghost has no border, uses `hover:bg-muted`.

### Card

```tsx
<Card>...</Card>
```

`rounded-3xl bg-card ring-1 ring-foreground/8 p-5 dark:ring-white/8`

No shadow, just a hairline ring. In dark mode, the lighter card surface (`#1e1e2a`) on the page background (`#171721`) creates the elevation visually.

### KPI Card

The KPI numeric value MUST be `font-mono text-3xl font-medium tabular-nums tracking-tight`. The icon chip uses a tonal background (`bg-{tone}/10`) with the matching text color, in a `rounded-2xl size-12` square (slightly larger than today for visual presence).

### Input / Select / Textarea

`rounded-2xl border-border bg-background h-10 px-3.5 text-sm focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring`

Bigger height (40px vs current 32px) for `comfortable` density and easier touch targets on tablet/mobile.

### Sidebar Item

`rounded-2xl px-3 py-2 text-sm`. Active state: `bg-foreground/8 text-foreground font-medium`. Hover: `bg-foreground/4`. No outlines, no underlines — surface darkening only.

### Badge

Pill-shape badges (`rounded-full`). Status badges use semantic tinted backgrounds (`bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30`) — already in `status-badge.tsx`, keep as-is.

### Table

No border-radius on table itself; cards wrap them. Row dividers via `divide-y divide-border`. Row hover `hover:bg-muted/40`. Column headers use `text-xs font-medium uppercase tracking-wide text-muted-foreground`. Numeric columns: `font-mono tabular-nums text-right`.

---

## Do's and Don'ts

### Do

- Use `rounded-full` on every Button and Badge — no exceptions. The pill is the visual signature.
- Use `rounded-3xl` (28px+) on every Card. Smaller radii break the rhythm.
- Use `font-mono tabular-nums` on every monetary value, every date, every reference number.
- Treat the brand color (Emerald `#10b981`) as success/positive only. Never as a primary action button.
- Use Action Black for primary CTAs in light mode; Mercury Blue in dark mode. One CTA per section maximum.
- Keep headlines at `font-medium` (500) — authority through size and tracking, not weight.
- Use the soft warm Off-White Sage `#f3efeb` for muted surfaces in light mode (never gray-blue).
- Use generous vertical spacing (`gap-6` / `gap-8`) between sections.

### Don't

- Don't use small radii (`rounded-md`, `rounded-lg`) on Buttons or Cards — only on tooltips/inputs.
- Don't use `box-shadow` for elevation on primary surfaces. Use background contrast or hairline rings.
- Don't introduce new accent colors beyond Emerald, Action Black/Mercury Blue, Amber, Rose. The palette is intentionally narrow.
- Don't bold headlines beyond weight 500 — Geist 500 at 32px+ is the maximum stroke we use.
- Don't use proportional figures for numbers — always tabular-nums.
- Don't use pure cold gray (`#a1a1a1`, `#737373`) for secondary text in light mode — always warm Gunmetal Gray `#615e5b`.
- Don't put the brand emerald on a button background — it will compete with status badges.
- Don't add gradients to surfaces, buttons, or accents. The system is flat and authoritative.

---

## Surfaces

### Light mode hierarchy

| Level | Color | Use |
|-------|-------|-----|
| 1 | `#ffffff` Canvas White | Page background |
| 2 | `#ffffff` Canvas White | Card surface (distinguished by ring, not bg) |
| 3 | `#f3efeb` Off-White Sage | Inset surfaces, table row hover, subtle sections |
| 4 | `#e9eaeb` Pebble | Inert button bg, dividers |

### Dark mode hierarchy

| Level | Color | Use |
|-------|-------|-----|
| 1 | `#171721` Deep Space | Page background — deepest layer |
| 2 | `#1e1e2a` Midnight Slate | Cards, popovers, dialogs |
| 3 | `#272735` Graphite | Elevated cards, secondary buttons, hover states |
| 4 | `#3a3a4d` (lighter Graphite) | Tertiary fills, inset highlights |

---

## Imagery

Faktivo uses minimal imagery — this is a working tool, not a marketing showcase. When images appear:

- **Logo (`faktivo-logo.svg`)** — used at 24-32px in sidebar/topbar; full horizontal logo at 36-48px in landing/auth pages.
- **Icons (Lucide React)** — `size-4` for inline UI, `size-5` for KPI chips, `size-6` only for empty states. Always `currentColor` (no hardcoded colors on icons).
- **Empty-state illustrations** — line-art only, monochrome, single emerald accent allowed. Never raster.
- **Charts** — Recharts via `chart.tsx`. Use chart palette tokens, never raw colors.

---

## Layout

**Page rhythm:** sidebar (16rem) + main content area, max-width 1280px (`max-w-7xl mx-auto`).
**Vertical rhythm:** main padding `px-4 py-6 md:px-6 lg:px-8` (already in app/layout). Card grid `gap-6`. Inside cards `gap-4`.
**Sticky topbar:** 56px height, `bg-background/80 backdrop-blur` (subtle), border-bottom `border-border`.
**Mobile:** sidebar collapses to drawer (existing shadcn behavior).
**Empty states:** centered card with icon (size-10) → heading-sm → body → primary CTA, `gap-3`, padding `py-12`.

---

## Quick Color Reference

```
LIGHT MODE
  page-bg:      #ffffff
  card-surface: #ffffff (with ring-foreground/8)
  inset:        #f3efeb
  text:         #111111
  muted-text:   #615e5b
  border:       #d8d3cc
  cta-bg:       #000000
  brand:        #10b981
  ring:         #10b981

DARK MODE
  page-bg:      #171721
  card-surface: #1e1e2a
  elevated:     #272735
  text:         #ededf3
  muted-text:   #c3c3cc
  border:       #70707d
  cta-bg:       #5266eb
  brand:        #10b981
  ring:         #10b981
```

---

## Migration Notes (from previous Anthropic-inspired plan)

- Removed Anthropic Sans/Serif/Mono — keeping Geist (already loaded, zero install).
- Removed Ivory Light `#faf9f5` (warm parchment) — replaced with pure Canvas White for max financial neutrality.
- Removed asymmetric button radius (0px 0px 8px 8px) — replaced with full pill (Titan signature).
- Removed feature card 24px radius — replaced with 28px (`rounded-3xl`) on all cards uniformly.
- Removed Clay `#d97757` accent — replaced with Faktivo Emerald `#10b981` (matches brand identity, financial association with growth).

---

## Tailwind v4 — `globals.css` integration

All tokens live as CSS custom properties in `:root` and `.dark`. `@theme inline { ... }` maps them to Tailwind utility classes. See `src/app/globals.css` for the canonical implementation.
