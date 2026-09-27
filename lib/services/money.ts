// Money is numeric in Postgres and a decimal string in TypeScript — never a float (CLAUDE.md rule 5).
// Arithmetic happens in integer paise (bigint); display uses Indian digit grouping: ₹1,23,456.

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/

/** Parses a decimal string ("123456.5") into integer paise, rounding half away from zero. */
export function toPaise(amount: string): bigint {
  const match = DECIMAL.exec(amount.trim())
  if (!match) throw new Error(`Not a decimal amount: "${amount}"`)
  const [, sign, rupees, fraction = ''] = match

  const padded = fraction.padEnd(3, '0')
  let paise = BigInt(rupees) * 100n + BigInt(padded.slice(0, 2))
  if (Number(padded[2]) >= 5) paise += 1n

  return sign ? -paise : paise
}

/** Groups an integer string the Indian way: last three digits, then pairs. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const head = digits.slice(0, -3)
  const tail = digits.slice(-3)
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`
}

export type PaiseDisplay = 'auto' | 'always' | 'never'

/**
 * Formats a decimal string as rupees: formatInr('123456') → '₹1,23,456'.
 * paise: 'auto' shows them only when non-zero (UI), 'always' for invoices and quotes,
 * 'never' rounds to the rupee (dashboards).
 */
export function formatInr(amount: string, paise: PaiseDisplay = 'auto'): string {
  let value = toPaise(amount)
  if (paise === 'never') {
    const remainder = value % 100n
    value = value - remainder + (remainder >= 50n ? 100n : remainder <= -50n ? -100n : 0n)
  }

  const negative = value < 0n
  const abs = negative ? -value : value
  const rupees = groupIndian((abs / 100n).toString())
  const fraction = (abs % 100n).toString().padStart(2, '0')

  const showPaise = paise === 'always' || (paise === 'auto' && fraction !== '00')
  return `${negative ? '-' : ''}₹${rupees}${showPaise ? `.${fraction}` : ''}`
}
