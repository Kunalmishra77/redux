import { handleMetaPost, handleMetaVerification, toResponse } from '@/lib/webhooks/handlers'
import { recordWebhook } from '@/lib/webhooks/record'

// WhatsApp Cloud API `messages` field. Same app secret and handshake as Meta lead ads.

export function GET(request: Request) {
  return toResponse(handleMetaVerification(new URL(request.url).searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''))
}

export async function POST(request: Request) {
  const raw = await request.text()
  return toResponse(
    await handleMetaPost('whatsapp', raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET ?? '', recordWebhook),
  )
}
