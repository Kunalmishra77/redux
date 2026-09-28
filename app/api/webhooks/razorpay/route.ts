import { handleRazorpay, toResponse } from '@/lib/webhooks/handlers'
import { recordWebhook } from '@/lib/webhooks/record'

// Razorpay. BR-I5: an invoice is marked paid only from this verified webhook, via the worker.

export async function POST(request: Request) {
  const raw = await request.text()
  return toResponse(
    await handleRazorpay(
      raw,
      request.headers.get('x-razorpay-signature'),
      request.headers.get('x-razorpay-event-id'),
      process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
      recordWebhook,
    ),
  )
}
