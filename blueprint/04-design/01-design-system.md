# 01 — Design System

Derived from REDUX's own pitch deck and the concept walkthrough approved in September 2026.
Implemented as **Tailwind v4 CSS-first tokens** (`@theme` in CSS — there is no
`tailwind.config.js` in v4) plus **shadcn/ui** components.

---

## 1. Colour

```css
@theme {
  /* Brand */
  --color-redux-blue:   #0047AB;   /* primary — 60–70% of visual weight */
  --color-redux-blue-2: #0340A0;   /* the watermark tint */
  --color-redux-lime:   #72F20D;   /* accent — CTAs and highlights ONLY */

  /* Neutrals */
  --color-ink:     #141B2D;        /* body text */
  --color-muted:   #5B6577;        /* secondary text */
  --color-faint:   #8A94A6;        /* captions, timestamps */
  --color-line:    #C9D6EE;        /* borders */
  --color-surface: #EEF3FB;        /* cards on white */
  --color-select:  #E3ECFB;        /* selected row */
  --color-pale:    #D6E2F7;        /* text on blue */

  /* Status */
  --color-success: #128C4A;
  --color-warning: #8A5A00;
  --color-warning-bg: #FFF1C2;
  --color-danger:  #B3261E;
  --color-whatsapp:#25D366;
}
```

### The accent rule
**Lime is never a background for body text and never more than ~10% of a screen.** It marks the
one action that matters: *Book free assessment*, *Call now*, *Confirm*, *New*, *Won*. Once
everything is lime, nothing is.

### Contrast
All pairs below meet WCAG 2.2 AA:

| Foreground | Background | Use |
|---|---|---|
| `--color-ink` | white | body |
| white | `--color-redux-blue` | inverted panels |
| `--color-redux-blue` | `--color-redux-lime` | primary button (dark on bright — this is the brand's signature) |
| `--color-muted` | white | secondary text |
| `--color-pale` | `--color-redux-blue` | secondary text on blue |

**Never** lime text on white — it fails contrast badly. Lime is a *fill*, not a *text colour*.

### Status colours (consistent across every screen)
| Meaning | Fill | Text |
|---|---|---|
| New / Won / positive | lime | blue |
| In progress | blue | white |
| Waiting / warning / due | `--color-warning-bg` | `--color-warning` |
| Scheduled / neutral | white + border | muted |
| Completed / historic | `--color-ink` | white |
| Failed / overdue | `--color-danger` tint | danger |

---

## 2. Type

**Inter** for everything (variable, self-hosted). Numerals **tabular** in every table, quote and
invoice — misaligned rupee columns look amateur on a document a hotel's finance team reads.

| Role | Size / weight | Notes |
|---|---|---|
| Display | 40–56 / 400 | Marketing hero only |
| H1 | 28–32 / 600 | Page title |
| H2 | 20–24 / 600 | Section |
| H3 | 16–18 / 600 | Card title |
| Body | 15–16 / 400 | 1.55 line height |
| Small | 13–14 / 400 | Secondary |
| Caption | 11–12 / 400 | Muted |
| Label | 11 / 600, +2 tracking, uppercase | Section eyebrows |
| Numeric | tabular-nums | Money, counts, dates |

**Money format:** `₹1,23,456` — Indian grouping (lakh/crore), not `123,456`. Use
`Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 })`.
This is tested in CI; it is the sort of thing that silently ships wrong.

---

## 3. Spacing, radius, elevation

4 px base. Use `2, 3, 4, 6, 8, 12, 16` on the Tailwind scale; do not invent in-between values.

| Token | Value | Use |
|---|---|---|
| radius-sm | 6 px | chips, inputs |
| radius-md | 10 px | cards |
| radius-lg | 14 px | panels |
| radius-full | 999 px | status pills, avatars |

Elevation: one shadow only — `0 2px 10px rgba(0,0,0,0.10)`. Cards sit on `--color-surface`;
depth comes from tint, not from stacked shadows.

---

## 4. The visual motif

**Icon in a filled circle** — carried across website, portals and app. Lime circle on blue panels,
pale-blue circle on white.

**Explicitly avoided** (these read as generic template work):
- Accent lines under headings
- Colour bars or stripes along a card edge
- Gradients as decoration
- More than one shadow depth
- Cream or beige backgrounds — the palette is blue, white and lime

---

## 5. Components

Built on shadcn/ui (CLI v4, Radix base — works with Tailwind v4 and React 19).

| Component | REDUX specifics |
|---|---|
| Button | Primary = lime fill, blue text. Secondary = blue fill, white text. Ghost = blue text. Destructive = danger outline |
| Status pill | Radius-full, 11px semibold, from the status table above |
| Data table | TanStack Table v9, sticky header, zebra `--color-surface`, tabular numerals, server pagination |
| Card | White, 1px `--color-line`, radius-md, single shadow |
| Empty state | Icon in a circle + one sentence + the primary action. Never a bare "No data" |
| Form | Label above input, helper below, error in danger with an icon. Inline validation on blur |
| Photo grid | 4:3 thumbnails, slot label overlay, lightbox on tap |
| Before/after | Two panes side by side, labelled BEFORE and AFTER. **Never a drag slider** — the comparison must survive a screenshot pasted into an email, which is how hotel engineers actually share things |
| Timeline | Vertical line + circled icons; actor and timestamp on every entry |
| Stage tracker | 7 dots with connectors; done = blue, current = lime, pending = line |

---

## 6. Responsive

| Breakpoint | Behaviour |
|---|---|
| `< 640` | Website fully responsive. Customer portal fully responsive. CRM is **not** optimised for phones — care executives work at desks |
| `640–1024` | Portal tablet layout; CRM usable with a collapsed sidebar |
| `> 1024` | Full CRM: sidebar + list + detail pane |

**Surveyor app** is a native Android app, not a responsive page — it follows §7.

---

## 7. Mobile app (Expo)

Same tokens, adapted for gloved hands in bad light.

| Concern | Rule |
|---|---|
| Touch targets | **56 dp minimum** — larger than the 48 dp default. Surveyors work in tight bathrooms holding a phone in one hand |
| Contrast | Increased: body on white, no muted text below 14 px. Hotel bathrooms are dim and phone screens get wet |
| Primary action | Full-width lime button fixed to the bottom of the screen |
| Photo slots | 2×2 grid, captured slots show a tick, remaining slots show a dashed blue outline. The state must be readable in a glance |
| Sync status | **Always visible in the header.** A surveyor should never have to go looking for whether their work is safe |
| Offline banner | Persistent, calm, not alarming: "Offline — 12 items saved on this device" |
| Errors | Never a raw error string. "Couldn't upload 3 photos. They're saved — we'll retry." |

---

## 8. Documents (quotation & invoice PDFs)

The PDF is the same Tailwind markup as the on-screen quote, rendered by Gotenberg — so they
cannot drift.

| Element | Spec |
|---|---|
| Page | A4, 18 mm margins |
| Header | REDUX wordmark left, document number right |
| Type | Inter 10 pt body, 8 pt table |
| Numbers | Tabular, right-aligned, `₹1,23,456` |
| Table | Header row blue with white text; 0.5 pt `--color-line` borders |
| "You save" | Lime-tinted row — **the one place the accent appears in a document** |
| Footer | GSTIN, address, page number, validity |
| Font | **Noto Sans baked into the Gotenberg image for the ₹ glyph.** The default container fonts render ₹ as an empty box, silently |

---

## 9. Accessibility (WCAG 2.2 AA)

- Contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI boundaries
- Visible focus ring: 2 px `--color-redux-blue`, 2 px offset
- Every input labelled; errors linked with `aria-describedby`
- Status never conveyed by colour alone — always a word or icon with it
- Keyboard: full CRM operation without a mouse, including the pipeline board
- Motion respects `prefers-reduced-motion`
- Tap targets ≥ 44 px web, ≥ 56 dp app
