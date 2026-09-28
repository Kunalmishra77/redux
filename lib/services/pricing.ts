import { formatInr, toPaise } from '@/lib/services/money'

/**
 * BR-A4: "You save" = market replacement − recommended option. Never negative: when it would not
 * be positive it is hidden (null), never shown as ₹0 or a minus. Mirrors assessments.you_save so
 * the surveyor app can show it offline before the server has priced the fitting.
 */
export function calculateYouSave(marketReplacement: string, recommended: string): string | null {
  const saving = toPaise(marketReplacement) - toPaise(recommended)
  if (saving <= 0n) return null
  const rupees = saving / 100n
  const paise = (saving % 100n).toString().padStart(2, '0')
  return `${rupees}.${paise}`
}

/** "You save ₹7,500" — or null, so the caller renders nothing. */
export function formatYouSave(marketReplacement: string, recommended: string): string | null {
  const saving = calculateYouSave(marketReplacement, recommended)
  return saving === null ? null : `You save ${formatInr(saving)}`
}
