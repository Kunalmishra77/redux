import { handleGoogleAds, toResponse } from '@/lib/webhooks/handlers'
import { recordWebhook } from '@/lib/webhooks/record'

// Google Ads lead form webhook. CLAUDE.md rule 6: Google must NEVER receive a 4XX — it does not
// retry, and the lead is lost forever. handleGoogleAds answers 200 {} (or 5XX, which is retried).

export async function POST(request: Request) {
  const raw = await request.text()
  return toResponse(await handleGoogleAds(raw, process.env.GOOGLE_ADS_WEBHOOK_KEY ?? '', recordWebhook))
}
