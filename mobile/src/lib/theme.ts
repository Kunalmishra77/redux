// REDUX design tokens (blueprint/04-design/01-design-system.md §1). Lime is a FILL for the one
// action that matters — never text on white, never more than ~10% of a screen.
export const colors = {
  blue: '#0047AB',
  blue2: '#0340A0',
  lime: '#72F20D',
  ink: '#141B2D',
  muted: '#5B6577',
  faint: '#8A94A6',
  line: '#C9D6EE',
  surface: '#EEF3FB',
  select: '#E3ECFB',
  pale: '#D6E2F7',
  white: '#FFFFFF',
  bg: '#F6F8FC',
  success: '#128C4A',
  successBg: '#E3F5EA',
  warning: '#8A5A00',
  warningBg: '#FFF1C2',
  danger: '#B3261E',
  dangerBg: '#FBE7E6',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const

/** Surveyor app global rule: touch targets 56 dp minimum (05-screens-surveyor-app.md). */
export const TOUCH = 56

export const type = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 16, color: colors.ink, lineHeight: 23 },
  small: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  caption: { fontSize: 12, color: colors.faint },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6, color: colors.muted, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
}
