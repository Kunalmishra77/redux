import { handleMetaPost, handleMetaVerification, toResponse } from '@/lib/webhooks/handlers'
import { recordWebhook } from '@/lib/webhooks/record'

// Meta lead ads (leadgen). ADR-008: verify the raw body, persist, 200 — processing is in the worker.
// No `export const dynamic`: POST handlers are always dynamic, and Next 16 removes that export once
// Cache Components is on.

export function GET(request: Request) {
  return toResponse(handleMetaVerification(new URL(request.url).searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''))
}

export async function POST(request: Request) {
  const raw = await request.text() // before any parsing: the HMAC is over the raw bytes
  return toResponse(
    await handleMetaPost('meta_leadgen', raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET ?? '', recordWebhook),
  )
}
