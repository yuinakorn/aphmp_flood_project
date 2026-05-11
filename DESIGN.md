# DESIGN.md — FloodWatch น่าน

## Theme

**Single calibrated dim surface.** Justified by physical scene: a duty officer at 2am in a low-light command center reading from 2–3m away, glancing back and forth between the screen and a paper map. A photic-bright white surface fatigues at that distance and that hour. A pure-black surface kills the operator's night vision when they look away. The chosen surface is a deep cool slate (oklch ~0.18) — readable as "calm" in daylight too.

No theme switcher (PRODUCT.md principle 7).

## Color (OKLCH, restrained strategy)

All neutrals carry a cool slate tint (hue 245, chroma 0.005–0.012) so the screen reads composed, not metallic.

### Neutrals — the surface palette

| Token              | OKLCH                  | Use                                              |
| ------------------ | ---------------------- | ------------------------------------------------ |
| `bg`               | `oklch(0.18 0.012 245)` | App surface                                     |
| `bg-elevated`     | `oklch(0.22 0.011 245)` | Sheets, popovers, panels lifted by 4dp          |
| `bg-sunken`       | `oklch(0.15 0.010 245)` | Inset wells (e.g. roster list inside the rail)  |
| `border`          | `oklch(0.30 0.012 245)` | Hairline dividers, panel edges                  |
| `border-strong`   | `oklch(0.40 0.013 245)` | Focused fields, selected rows                   |
| `fg`              | `oklch(0.96 0.005 245)` | Primary text                                     |
| `fg-muted`        | `oklch(0.72 0.008 245)` | Secondary labels, metadata                       |
| `fg-subtle`       | `oklch(0.55 0.010 245)` | Tertiary captions, placeholders                  |

### Accent — one color carries authority

| Token        | OKLCH                  | Use                                                  |
| ------------ | ---------------------- | ---------------------------------------------------- |
| `accent`     | `oklch(0.68 0.15 230)` | Primary actions, links, focus rings, active layer    |
| `accent-fg`  | `oklch(0.18 0.012 245)` | Text on accent fill                                  |

### Status — semantic, never decorative

| Token         | OKLCH                  | Use                                       |
| ------------- | ---------------------- | ----------------------------------------- |
| `risk-flood`  | `oklch(0.66 0.20 30)`  | In-flood (high risk) pills, marker rings |
| `risk-near`   | `oklch(0.78 0.16 75)`  | Near-flood (amber) pills                  |
| `risk-safe`   | `oklch(0.74 0.10 145)` | Safe (muted green)                        |
| `signal-data` | `oklch(0.78 0.14 200)` | SAR / satellite data accents (subtle)     |

**Discipline**: status colors only appear on data that carries that status. They never appear on chrome (no green checkmarks in headers, no red borders on warnings).

## Typography

**Single Thai-aware family** + a monospace for numeric precision.

- Sans: **IBM Plex Sans Thai** (covers Thai + Latin, the same character heights). Weights: 400, 500, 600, 700.
- Mono: **JetBrains Mono** (only for: coordinates, counts, timestamps, IDs, keyboard shortcuts).

### Scale (1.25 ratio between steps)

| Token         | Size / Line height | Use                                       |
| ------------- | ------------------ | ----------------------------------------- |
| `text-xs`     | 12 / 16            | Pills, metadata, captions                 |
| `text-sm`     | 13 / 20            | Body, table cells, form input             |
| `text-base`   | 15 / 22            | Section labels, default reading           |
| `text-md`     | 17 / 24            | Subhead                                   |
| `text-lg`     | 22 / 28            | Page title, status-strip primary numerics |
| `text-xl`     | 30 / 34            | Hero count (used sparingly, max 1/screen) |
| `text-display` | 44 / 48           | Reserved for empty-state hero (not used in MVP) |

Weight rules: numbers carry weight 600 in mono; Thai body carries 400; labels above numbers are 500 uppercase tracked +0.04em.

## Spacing scale

```
1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96  (px)
```

Vertical rhythm = 4px base. Density is high in tables and the rail (gap-2 / gap-3), generous around critical numerics on the status strip (gap-6 / gap-8). This *variation* is intentional — uniform padding everywhere is monotony (impeccable layout law).

## Radius

```
sm: 4px   md: 6px   lg: 10px   xl: 14px
```

Pills and tiny chips use `sm`. Panels use `md`. Sheets and popovers use `lg`. No `2xl+` or pill-radius on cards.

## Elevation

Two levels only — surfaces lift by light, not by drop shadow.

- **e0**: flush. The map and the status strip.
- **e1**: slide-over panels and popovers. Background = `bg-elevated`, a hairline `border` on the meeting edge, soft shadow `0 4px 16px oklch(0 0 0 / 0.45)`. No multi-layered shadows.

## Layout shell

Departs from the prototype's sidebar+map split. Adopts a **status-strip + rail + map + slide-over** shell:

```
┌────────────────────────────────────────────────────────────┐
│ Masthead (48px): FloodWatch · context · session · sign in  │
├────────────────────────────────────────────────────────────┤
│ Status strip (56px): live counts, last SAR pass, severity  │
├────┬───────────────────────────────────────────────────────┤
│ R  │                                                       │
│ a  │                                                       │
│ i  │                      MAP (dominant)                   │
│ l  │                                                       │
│    │                                                       │
│ 56 │                                                       │
└────┴───────────────────────────────────────────────────────┘
```

- **Rail (56px)**: 4–5 icon-only verbs (Layers, Roster, Routes, Events, Search). Tap any → a 360px slide-over panel docks beside the rail, doesn't push the map.
- **Status strip**: horizontal, separators between fields, never card boxes. Mono numerics. Last SAR-pass timestamp lives at the right edge with a thin pulsing dot if data is fresh (<6h).
- **Map**: fills the rest of the viewport. Basemap switcher and zoom controls hug the bottom-right corner (one cluster, not split). Slider for radius/heatmap/opacity is collapsed by default, expands from a single "tune" button — declutter the map until the operator asks.

## Components

Built on **shadcn/ui** primitives. We never reinvent dialog/sheet/popover/select/tooltip/toast/command. Tailwind is for composition only.

### Status pill

`[●  In flood]` — leading dot in the risk color, label in `text-xs` weight 500. Background = transparent on neutral surfaces, `bg-{risk}/12` on emphasized rows. Never full-saturation pill backgrounds.

### Risk roster row

A row in the rail's Roster panel:
```
●  สมชาย ใจดี                     78 · ติดเตียง
   บ้านดอนแก้ว                                  In flood ⌥
```
Identity line at `text-sm/500`, metadata at `text-xs/400/muted`. Risk pill right-aligned. Whole row is a button (full hit target). Selection highlight = 1px `border-strong` + 4px `accent`-tinted background.

### Stat field (status strip)

Vertical stack, no border:
```
จุดน้ำท่วม
813
+50.7 ตร.กม.
```
Label in `text-xs` uppercase tracked +0.04em, number in `text-lg` mono weight 600, delta in `text-xs` mono `fg-muted`. Adjacent fields separated by a 1px `border` 24px-tall vertical line, never by a box.

## Map-specific aesthetics

- Marker DOM is removed; vulnerable persons render as Leaflet `circleMarker` (vector, not div-icon HTML emoji). Color = risk color, stroke = `bg-elevated`.
- Heatmap gradient uses our risk palette, not the rainbow palette: amber → orange → red → deep-red. The current rainbow (yellow → orange → red → magenta) is replaced.
- S2 flood polygons render with `accent` stroke and `accent/22` fill — the operator's eye reads them as "the trusted data layer" rather than "decoration."
- Basemap defaults to a muted satellite (ESRI Imagery + low-contrast labels). Avoid Google Hybrid (loud yellow roads).

## Motion

- All transitions use `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) at 180ms.
- The status-strip live indicator pulses opacity 0.55 → 1 over 2.4s, never blink-style.
- Slide-over panels enter on `transform: translateX` with `will-change: transform`; map never re-layouts.
- Reduced-motion: all transforms collapse to opacity-only at 120ms.

## Icons

**Lucide** at 1.5 stroke, 16px in dense areas, 18px in rail. No emoji as iconography. The only emoji usage allowed: text content authored by the user (e.g., a comment field).

## Anti-patterns rejected here

- Side-stripe borders on cards (banned by impeccable law).
- Gradient text. Never.
- Glassmorphic blurs on panels — slide-overs are opaque `bg-elevated`.
- Identical card grids (the prototype's 2×2 stat boxes are gone).
- Modals as first thought — we use Sheet (slide-over) for detail views, Popover for compact info; Dialog reserved for destructive confirmation only.
