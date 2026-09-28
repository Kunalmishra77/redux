// The worker talks to Postgres directly (not through PostgREST): pgmq lives in its own schema, and a
// direct session carries no JWT claims, so is_system_caller() treats the worker as the system.
import type { QueryResult, QueryResultRow } from 'pg'

export type Db = {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>
}

export type QueueName = 'q_webhooks' | 'q_notifications' | 'q_capi' | 'q_documents' | 'q_reports'
export type QueueMessage = { msg_id: string; read_ct: number; message: Record<string, unknown> }

export async function readQueue(db: Db, queue: QueueName, visibilitySeconds: number, batch: number): Promise<QueueMessage[]> {
  const { rows } = await db.query<QueueMessage>(
    'select msg_id::text, read_ct, message from pgmq.read($1::text, $2::integer, $3::integer)',
    [queue, visibilitySeconds, batch],
  )
  return rows
}

export async function deleteMessage(db: Db, queue: QueueName, msgId: string): Promise<void> {
  await db.query('select pgmq.delete($1::text, $2::bigint)', [queue, msgId])
}

export async function archiveMessage(db: Db, queue: QueueName, msgId: string): Promise<void> {
  await db.query('select pgmq.archive($1::text, $2::bigint)', [queue, msgId])
}

export async function sendMessage(db: Db, queue: QueueName, message: unknown, delaySeconds = 0): Promise<void> {
  await db.query('select pgmq.send($1::text, $2::jsonb, $3::integer)', [queue, JSON.stringify(message), Math.max(0, Math.round(delaySeconds))])
}

/** A failure that retrying will never fix (no phone number, no invoice id, template not approved). */
export class PermanentError extends Error {}
