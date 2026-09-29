import { formatInr } from '@/lib/services/money'

export { formatInr }

const IST = 'Asia/Kolkata'

export function inr(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—'
  try {
    return formatInr(amount, 'never')
  } catch {
    return '—'
  }
}

function parts(iso: string) {
  const d = new Date(iso)
  // IST is UTC+5:30 with no DST — compute without relying on Intl time-zone data in Hermes
  const ist = new Date(d.getTime() + 330 * 60_000)
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate(), h: ist.getUTCHours(), min: ist.getUTCMinutes(), day: ist.getUTCDay() }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function timeIST(iso: string): string {
  const p = parts(iso)
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12
  return `${h12}:${String(p.min).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`
}

export function dayKeyIST(iso: string): string {
  const p = parts(iso)
  return `${p.y}-${p.m}-${p.d}`
}

export function dayLabelIST(iso: string): string {
  const today = dayKeyIST(new Date().toISOString())
  const tomorrow = dayKeyIST(new Date(Date.now() + 86_400_000).toISOString())
  const k = dayKeyIST(iso)
  const p = parts(iso)
  const date = `${DAYS[p.day]} ${p.d} ${MONTHS[p.m]}`
  if (k === today) return `Today · ${date}`
  if (k === tomorrow) return `Tomorrow · ${date}`
  return date
}

export function ago(iso: string | null): string {
  if (!iso) return 'never'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86_400)} d ago`
}

export const TIME_ZONE = IST
