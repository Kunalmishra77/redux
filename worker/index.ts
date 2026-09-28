// The queue worker (ADR-009): one small Node process next to the web app. It drains the pgmq
// queues; everything it does to the database happens in one transaction per message, together with
// deleting that message — so a crash never half-processes a lead or double-sends a WhatsApp.
//
//   pnpm worker            (reads WORKER_DATABASE_URL, falls back to SUPABASE_DB_URL)
//   pnpm worker --once     (drain what is there now, then exit — used by the smoke test)

import pg from 'pg'
import { createGraphClient, type GraphClient } from '@/lib/integrations/meta-graph'
import { archiveMessage, deleteMessage, PermanentError, readQueue, type Db, type QueueMessage, type QueueName } from './db'
import { deadLetter, processWebhookEvent, reconcileMetaLeads } from './processors/webhooks'
import { processNotification, type WhatsAppConfig } from './processors/notifications'
import { processCapiEvent, type CapiConfig } from './processors/capi'

export type WorkerDeps = { graph: GraphClient | null; whatsapp: WhatsAppConfig | null; capi: CapiConfig | null }

const VISIBILITY_SECONDS = 120
const BATCH = 10
const MAX_READS = 10          // a message that keeps crashing the worker is archived and alerted

export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): WorkerDeps {
  const graph = env.META_SYSTEM_USER_TOKEN
    ? createGraphClient({ version: env.META_GRAPH_VERSION ?? 'v25.0', accessToken: env.META_SYSTEM_USER_TOKEN })
    : null
  return {
    graph,
    whatsapp: env.WHATSAPP_PHONE_NUMBER_ID ? { phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID } : null,
    capi: env.META_CAPI_DATASET_ID && env.WHATSAPP_BUSINESS_ACCOUNT_ID
      ? { datasetId: env.META_CAPI_DATASET_ID, wabaId: env.WHATSAPP_BUSINESS_ACCOUNT_ID }
      : null,
  }
}

async function handle(db: Db, deps: WorkerDeps, queue: QueueName, msg: QueueMessage): Promise<void> {
  const m = msg.message
  if (queue === 'q_webhooks' && typeof m.webhook_event_id === 'string') {
    await processWebhookEvent(db, deps.graph, m.webhook_event_id)
  } else if (queue === 'q_webhooks' && m.task === 'meta_reconcile') {
    if (deps.graph) await reconcileMetaLeads(db, deps.graph, String(m.since))
  } else if (queue === 'q_notifications' && typeof m.message_id === 'string') {
    await processNotification(db, deps.graph, deps.whatsapp, m.message_id)
  } else if (queue === 'q_capi' && typeof m.capi_event_id === 'string') {
    await processCapiEvent(db, deps.graph, deps.capi, m.capi_event_id)
  } else {
    throw new PermanentError(`Unrecognised ${queue} message: ${JSON.stringify(m).slice(0, 200)}`)
  }
}

/**
 * Process one message in its own transaction. `inTransaction` is for tests that wrap everything in
 * an outer transaction they roll back: then savepoints stand in for BEGIN/COMMIT.
 */
export async function processMessage(client: pg.PoolClient | pg.Client, deps: WorkerDeps, queue: QueueName,
                                     msg: QueueMessage, inTransaction = false): Promise<'done' | 'failed'> {
  const begin = inTransaction ? 'savepoint msg' : 'begin'
  const commit = inTransaction ? 'release savepoint msg' : 'commit'
  const rollback = inTransaction ? 'rollback to savepoint msg' : 'rollback'

  if (msg.read_ct > MAX_READS) {
    await archiveMessage(client, queue, msg.msg_id)
    console.error(`[worker] ${queue} #${msg.msg_id} archived after ${msg.read_ct} reads`)
    return 'failed'
  }

  await client.query(begin)
  try {
    await handle(client, deps, queue, msg)
    await deleteMessage(client, queue, msg.msg_id)
    await client.query(commit)
    return 'done'
  } catch (err) {
    await client.query(rollback)
    const reason = err instanceof Error ? err.message : String(err)
    // Webhook events have their own retry bookkeeping; other queues redeliver after the timeout.
    if (queue === 'q_webhooks' && typeof msg.message.webhook_event_id === 'string') {
      const id = msg.message.webhook_event_id
      await client.query(begin)
      if (err instanceof PermanentError) await deadLetter(client, id, reason)
      else await client.query('select public.webhook_failed($1, $2)', [id, reason])   // re-queues with backoff
      await deleteMessage(client, queue, msg.msg_id)
      await client.query(commit)
    } else if (err instanceof PermanentError) {
      await archiveMessage(client, queue, msg.msg_id)
    }
    console.error(`[worker] ${queue} #${msg.msg_id}: ${reason}`)
    return 'failed'
  }
}

export async function drainOnce(client: pg.PoolClient | pg.Client, deps: WorkerDeps, inTransaction = false): Promise<number> {
  let handled = 0
  for (const queue of ['q_webhooks', 'q_notifications', 'q_capi'] as const) {
    for (const msg of await readQueue(client, queue, VISIBILITY_SECONDS, BATCH)) {
      await processMessage(client, deps, queue, msg, inTransaction)
      handled++
    }
  }
  return handled
}

async function main(): Promise<void> {
  const connectionString = process.env.WORKER_DATABASE_URL ?? process.env.SUPABASE_DB_URL
  if (!connectionString) throw new Error('WORKER_DATABASE_URL is not set')
  const pool = new pg.Pool({ connectionString, max: 2, ssl: { rejectUnauthorized: false } })
  const deps = depsFromEnv()
  const once = process.argv.includes('--once')
  let stopping = false
  for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { stopping = true })

  console.log(`[worker] started (graph: ${deps.graph ? 'on' : 'off'}, whatsapp: ${deps.whatsapp ? 'on' : 'off'}, capi: ${deps.capi ? 'on' : 'off'})`)
  do {
    const client = await pool.connect()
    let handled = 0
    try {
      handled = await drainOnce(client, deps)
    } catch (err) {
      console.error('[worker] loop error', err)
    } finally {
      client.release()
    }
    if (!once && handled === 0) await new Promise((r) => setTimeout(r, 2000))
    if (once && handled === 0) break
  } while (!stopping)
  await pool.end()
}

if (process.argv[1] && /worker[\\/]index\.ts$/.test(process.argv[1])) {
  main().catch((err) => { console.error(err); process.exit(1) })
}
