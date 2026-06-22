# Payrole Design System

**Payrole** is a modern global-payroll & contractor-management platform — onboard
contractors, run international payroll, manage contracts, invoices, documents and
compliance from one clean dashboard. This design system captures Payrole's brand,
foundations, component library and full-screen UI kits so any new interface or
asset can be built on-brand.

> Product surfaces represented: the **Payrole web dashboard** (freelancer view) and
> the **Payrole marketing website**.

## Sources
Everything here was extracted from the attached Figma file:
- **Figma:** `[FREE] - Payroll Dashboard (Community) (복사).fig` — pages **Styleguide**
  (Colors, Typography, Icons, Components) and **UI-Design** (Dashboard v1–v3,
  CRM-Platform). A community "Payroll Management UI Kit".
- No codebase was provided. If you have the production repo or the editable Figma,
  share them to deepen fidelity (exact easing, real font files, full icon set).

---

## Content fundamentals
How Payrole writes copy:
- **Voice:** warm, direct, second person. Speaks **to** the user — "Here's your
  dashboard overview.", "Pay your global team, the simple way." Product greets by
  name: *"Good morning, Chris"*.
- **Casing:** Headings and section titles use **Title Case** ("Total Outstanding",
  "Withdraw Method", "Transaction History", "Create A Contract"). Body and helper
  text are sentence case.
- **Tone:** confident and plain. Short verb-first labels ("Get Started", "See All",
  "Send Invoice", "Book a demo"). No jargon, no exclamation-heavy hype.
- **Numbers:** money is the hero — large, bold, with a de-emphasised cents/decimal
  tail ("$58,764**.25**", "$12,135**.69**"). Dates written long ("April 1st, 2022",
  "1 Jun 2022"). Deltas as signed percentages in pills ("+23%", "-2%").
- **Marketing:** benefit-led and aspirational but grounded — "Streamline your global
  business and grow your team effortlessly." Asterisked fine print under prices.
- **Emoji:** essentially none in product UI. A single sparkle (✦) appears as a
  decorative badge marker on marketing. Status is communicated with **color + icon +
  word** (a green check + "Connected"), never an emoji.

## Visual foundations
- **Color:** a calm, trustworthy palette. **Brand blue `#3981F7`** for primary
  actions and accents; **navy ink `#0A112F` / `#000929`** for text and the inverted
  CTA/pricing surface. Generous neutrals (greys `#FAFAFA`→`#0B0B0C`). Semantics:
  **green `#0AAF60`** (positive/connected), **red `#FA4545`** (negative/overdue),
  **amber `#F5A623`** (warning). Soft blue tints (`#EBF3FF`, `#E0EDFF`) back icon
  chips and badges. A violet `#7065F0` is used on the type specimen and as the
  Figma toggle ON color.
- **Type:** **TT Hoves** (geometric grotesque) throughout — Regular/Medium/DemiBold/
  Bold. Two heading ramps: a large **Website** ramp (up to 100px Bold) and a compact
  **Dashboard** ramp (40 / 32 / 24px). Body 12–24px. Tight tracking on large
  headings (≈ -0.02em). *Substitute in use: **Onest** from Google Fonts — see Caveats.*
- **Spacing & layout:** 4px base scale. Roomy 24–40px gutters in the dashboard;
  two-column app layout (fixed 268px sidebar + fluid content, right rail ~392px).
  Marketing is centered, max-width ~880–980px.
- **Corners:** soft and consistent — **16px** standard cards, 12px small cards/inputs,
  8px icon tiles, **fully pill** (999px) buttons, badges, chips, toggles, tabs.
- **Borders:** hairline `1px` neutral (`#ECECEC`/`#E4E4E7`), often as an inset
  box-shadow rather than a border so it never shifts layout.
- **Shadows:** low-opacity **navy** shadows (`rgba(0,35,82,0.06–0.10)`), soft and
  diffuse — cards rest on `shadow-sm`, lift to `shadow-md` on hover. No harsh black
  drop shadows. Primary buttons can carry a faint blue glow.
- **Backgrounds:** clean white pages over an off-white `#FAFAFA` canvas. No gradients
  in product chrome (the only gradient is the green area-fill under the payment
  chart). No textures, patterns or illustrations in the app shell.
- **Imagery:** real photography and 3D **memoji** avatars on transparent PNGs (warm,
  bright, friendly), always circular. Company marks sit in rounded tiles.
- **Motion:** restrained. 150–180ms ease transitions on hover/background/toggle
  knob; buttons nudge down ~1px on press. No bounces, no looping decorative motion.
- **Hover / press:** primary darkens (`#3981F7`→`#2D6FE0`→`#1F5BC4`); neutral
  surfaces go to `grey-50/100`; ghost actions reveal a blue-tint wash; press adds the
  1px translate. Focus shows a 4px brand-blue ring (`rgba(57,129,247,0.18)`).
- **Cards:** white, 16px radius, hairline border, soft navy shadow, 24px padding —
  the workhorse surface. The inverted variant (navy `#000929`) is reserved for the
  paid pricing tier and dark CTAs.

## Iconography
- **Set:** **Iconsax / vuesax — Bold (filled)** style: 24×24 grid, solid filled
  glyphs with rounded corners, single-color, paint with `currentColor`.
- **Delivery:** bundled as inline SVG path data in `assets/icons/icon-data.js` and
  rendered through the `Icon` component (`<Icon name="home" size={24} />`). 44 icons
  cover navigation (home, contracts, document, invoices, transactions, secure, card,
  settings), finance (dollar, money, coin, income, statistics), and UI (plus, close,
  check, search, eye, edit, trash, copy, list, chevrons, menu, bell, calendar, mail,
  globe, earth, user, add-user, profile, download, cloud, warning, target, diamond,
  notes, camera).
- **Source vs. authored:** ~30 icons were copied straight from the Figma SVGs; a
  handful of common UI glyphs (plus, close, search, user, edit, document, trash,
  contracts, transactions, invoices, statistics, card, list, copy, add-user) did not
  decode cleanly from the file and were **re-authored by hand** in the same filled
  style — flagged in Caveats. They are close, not pixel-identical to the originals.
- **Emoji / unicode:** not used as iconography. (A decorative ✦ appears once on
  marketing only.)

---

## Index / manifest
**Root**
- `styles.css` — global entry point (import manifest only). Consumers link this.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`.
- `readme.md` — this file. `SKILL.md` — portable Agent-Skill wrapper.

**Components** (`window.PayroleDesignSystem_9db006`)
- `components/core/` — Button, IconButton, Badge, Label, Status, Avatar + AvatarGroup,
  Card + CardHeader, ProgressBar.
- `components/forms/` — Input, TextArea, Select, Toggle, Checkbox, RadioButton.
- `components/navigation/` — SegmentedTabs, Breadcrumbs, SidebarNav + SidebarItem.
- `components/feedback/` — Alert.
- `components/icons/` — Icon (44-glyph filled set).

**Foundations** (`guidelines/`, shown in the Design System tab)
- Colors: brand, blue tints, greyscale, semantic. Type: typeface, website ramp,
  dashboard & body. Spacing: radii, shadows, spacing scale. Brand: logo.

**UI kits**
- `ui_kits/dashboard/` — interactive Payrole dashboard (Home + Contracts + shell).
- `ui_kits/website/` — Payrole marketing landing page.

**Assets** (`assets/`)
- `brand/` — Payrole logo (wordmark + pinwheel mark), memoji sheet.
- `avatars/` — memoji / photo avatars. `icons/` — 44 SVGs + `icon-data.js`.

---

## Caveats
- **Font substitution:** TT Hoves is a commercial TypeType font; we ship **Onest**
  (Google Fonts) as a close geometric-grotesque stand-in. Swap `tokens/fonts.css`
  for self-hosted TT Hoves `@font-face` rules when you have the licensed binaries.
- **Hand-authored icons:** ~15 UI glyphs were redrawn (see Iconography) because their
  geometry didn't extract from the .fig. Visually on-brand but not exact.
- **Brand/company logos:** third-party marks (PayPal, QuickBooks, Xero, etc.) shown
  in the Figma are omitted; PayPal is represented with a neutral tile placeholder.
