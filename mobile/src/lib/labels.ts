import type { Treatment } from '@/lib/services/assessment-pricing'

export const TREATMENT_LABEL: Record<Treatment, string> = {
  restore_finish: 'Restore finish',
  repair_function: 'Repair function',
  replace_eurobrass: 'Replace (Eurobrass)',
  no_action: 'No action',
}

/** Customer-facing words for the on-site quote (C10) — no internal jargon. */
export const TREATMENT_CUSTOMER: Record<Treatment, string> = {
  restore_finish: 'Restore',
  repair_function: 'Repair',
  replace_eurobrass: 'New Eurobrass',
  no_action: 'Leave as is',
}
