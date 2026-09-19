# Design Tokens Reference

Derived from the EV-charger reference design and structured for dense analyst workstation ergonomics.

## 1. Color Palette

| Token | Hex | Role | Contrast Ratio (vs Surface / Canvas) |
|---|---|---|---|
| `ink` | `#0F172A` | Primary typography, high-contrast dark UI | 15.6:1 (Passes WCAG AAA) |
| `slate-700` | `#334155` | Secondary text, active icons | 9.7:1 (Passes WCAG AAA) |
| `slate-500` | `#64748B` | Tertiary text, map labels, captions | 4.6:1 (Passes WCAG AA) |
| `slate-200` | `#E2E8F0` | 1px border on all docked panels | 1.2:1 (Structural border) |
| `slate-100` | `#F1F5F9` | Inset surfaces, track fills, score 0-19 | N/A |
| `surface` | `#FFFFFF` | Panels, cards, floating chrome | Base |
| `canvas` | `#F8FAFC` | App background behind panels | Base |
| `brand-700` | `#047857` | Pressed/hover state for primary actions | 5.2:1 |
| `brand-600` | `#059669` | Primary actions, active toggles, selected pins | 4.5:1 (Passes WCAG AA) |
| `brand-50` | `#ECFDF5` | Selected row tint, brand chip background | N/A |
| `amber-600` | `#D97706` | Caution, "meets threshold but weak" | 4.5:1 |
| `red-700` | `#B91C1C` | Hard constraint violated, error state | 7.0:1 |
| `blue-600` | `#2563EB` | User location, isochrone lines | 4.6:1 |

### Score Ramp (Single-Hue Sequential)
- **0–19**: `#F1F5F9` (slate-100)
- **20–39**: `#A7F3D0`
- **40–59**: `#6EE7B7`
- **60–79**: `#34D399`
- **80–100**: `#059669` (brand-600)

*Note: Never purple, never rainbow.*

---

## 2. Typography

- **Interface font:** `Inter Tight` (Weights: 400 regular, 500 medium, 600 semibold).
- **Tabular / Monospace font:** `IBM Plex Mono` (Weights: 400, 500, 600) with `font-variant-numeric: tabular-nums` globally.
- **Base body:** `13px` at `1.55` line height.
- **Type Scale:**
  - `11px` (caption, metadata, tags)
  - `12px` (secondary labels, table headers)
  - `13px` (body text, list items, input fields)
  - `15px` (section headers, emphasized card titles)
  - `19px` (panel titles)
  - `24px` (modal / view headers)
  - `32px` (readiness score display)

---

## 3. Radiuses, Elevation & Spacing

- **Inputs / Chips:** `4px` (`rounded-chip` / `rounded-input`)
- **Buttons / Tiles:** `6px` (`rounded-btn` / `rounded-tile`)
- **Panels / Sheets:** `10px` (`rounded-panel` / `rounded-sheet`)
- **Circular Map Controls only:** `9999px` (`rounded-full`)
- **Floating Chrome Shadow:** `0 4px 12px rgba(15,23,42,0.10)` (`shadow-float`)
- **Bottom Sheet / Modal Shadow:** `0 -8px 24px rgba(15,23,42,0.12)` (`shadow-sheet`)
- **Docked Panel Border:** `1px solid #E2E8F0`
- **Grid Spacing Base:** `4px` (4, 8, 12, 16, 24, 32px)
