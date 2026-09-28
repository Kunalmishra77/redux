'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Result } from '@/lib/result'
import type { Database } from '@/types/database'

// Job actions (D11). The rules live in the database functions: BR-J1 (one stage at a time, backward
// needs a reason), BR-J2 (blocked stops the clock), D11-07 (handover checks), BR-J4 (warranty start).

type Stage = Database['public']['Enums']['job_stage']

const PG_MESSAGES: Record<string, string> = {
  '42501': 'You can’t change this job.',
  '22023': 'This unit can’t do that right now.',
  '23514': 'That move isn’t allowed.',
}
const fail = (e: { code?: string; message: string }) => {
  // our own raise messages are written for people — pass them through, minus the rule tag
  const own = /BR-|D11-|blocked|already at|Stages move/.test(e.message)
  return { ok: false as const, code: e.code ?? 'FAILED', message: own ? e.message.replace(/\s*\((BR|D11)-[A-Z0-9-]+\)/g, '') : PG_MESSAGES[e.code ?? ''] ?? 'That didn’t work. Try again.' }
}
const done = (jobId: string) => { revalidatePath(`/staff/jobs/${jobId}`, 'layout'); revalidatePath('/staff/jobs') }

export async function moveStageAction(jobId: string, unitId: string, to: Stage, reason?: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('move_unit_stage', { p_unit: unitId, p_to: to, p_reason: reason || undefined })
  if (error) return fail(error)
  done(jobId)
  return { ok: true, data: null }
}

export async function blockUnitAction(jobId: string, unitId: string, reason: string, note?: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('block_unit', { p_unit: unitId, p_reason: reason, p_note: note || undefined })
  if (error) return fail(error)
  done(jobId)
  return { ok: true, data: null }
}

export async function unblockUnitAction(jobId: string, unitId: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('unblock_unit', { p_unit: unitId })
  if (error) return fail(error)
  done(jobId)
  return { ok: true, data: null }
}

export async function recordHandoverAction(jobId: string, input: { job_unit_id: string; leak_check: boolean; operation_check: boolean; finish_check: boolean; customer_name: string; notes?: string }): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_handover', { p: input })
  if (error) return fail(error)
  done(jobId)
  return { ok: true, data: null }
}
