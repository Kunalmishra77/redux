import type { PillTone } from '@/components/patterns'

// Status labels and pill tones for the document tables. Plain module — server and client.
export const QUOTE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  draft: { label: 'Draft', tone: 'neutral' }, pending_approval: { label: 'Discount approval', tone: 'waiting' }, sent: { label: 'Sent', tone: 'progress' },
  approved: { label: 'Approved', tone: 'positive' }, rejected: { label: 'Rejected', tone: 'failed' }, expired: { label: 'Expired', tone: 'failed' },
  superseded: { label: 'Superseded', tone: 'done' },
}

export const JOB_STATUS: Record<string, { label: string; tone: PillTone }> = {
  planned: { label: 'Planned', tone: 'neutral' }, in_progress: { label: 'In progress', tone: 'progress' },
  completed: { label: 'Completed', tone: 'positive' }, cancelled: { label: 'Cancelled', tone: 'failed' },
}

export const UNIT_STATUS: Record<string, { label: string; tone: PillTone; tile: string }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral', tile: 'border-line bg-white' },
  in_progress: { label: 'In progress', tone: 'progress', tile: 'border-redux-blue/30 bg-select' },
  blocked: { label: 'Blocked', tone: 'failed', tile: 'border-danger/40 bg-danger-bg' },
  back_in_service: { label: 'Back in service', tone: 'positive', tile: 'border-success/30 bg-[#EAF7EE]' },
}

// B24: a blocked unit shows who it is blocked ON — the attribution settles "you're late" (BR-J2)
export const BLOCK_REASONS: Record<string, { label: string; on: string }> = {
  civil_work: { label: 'Civil work', on: 'property' },
  access: { label: 'No access to the room', on: 'property' },
  customer_hold: { label: 'Customer on hold', on: 'customer' },
  parts: { label: 'Waiting for parts', on: 'REDUX' },
  other: { label: 'Other', on: 'see note' },
}
