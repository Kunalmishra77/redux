'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Result } from '@/lib/result'

// Stock (D15) and service requests (D16). Rules in the database: BR-ST1 (never below zero), BR-ST2
// (every movement has an actor), D15-04 (consumption against a job); the SR state machine and its
// acknowledge/resolve clocks (BR-SR1).

const fail = (e: { code?: string; message: string }) => ({
  ok: false as const, code: e.code ?? 'FAILED',
  message: ['22023', '23514'].includes(e.code ?? '') ? e.message.replace(/\s*\((BR|D)\d*-[A-Z0-9-]+\)/g, '')
    : e.code === '42501' ? 'You can’t do that.' : 'That didn’t work. Try again.',
})

export type MovementInput = { item_id: string; type: 'in' | 'out' | 'consumed' | 'adjusted'; quantity: number; job_id?: string; reason?: string }

export async function recordMovementAction(input: MovementInput): Promise<Result<null>> {
  if (!Number.isFinite(input.quantity) || input.quantity === 0) return { ok: false, code: 'QTY', message: 'Enter a quantity.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_stock_movement', { p: { ...input, quantity: String(input.quantity) } })
  if (error) return fail(error)
  revalidatePath('/staff/admin/stock', 'layout')
  return { ok: true, data: null }
}

export async function progressServiceRequestAction(id: string, to: string, note?: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('progress_service_request', { p_id: id, p_to: to, p_note: note || undefined })
  if (error) return fail(error)
  revalidatePath('/staff/service-requests')
  return { ok: true, data: null }
}
