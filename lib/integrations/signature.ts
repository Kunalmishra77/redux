import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// ADR-008: every webhook is verified on the RAW body (HMAC is over bytes, not parsed JSON), with a
// timing-safe compare so the check leaks nothing about the expected value.

export function sha256Hex(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

/** Constant-time string comparison; unequal lengths are compared against themselves first. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

/** Meta and WhatsApp: X-Hub-Signature-256: sha256=<hex HMAC of the raw body with the app secret> */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false
  return safeEqual(header.slice('sha256='.length), hmacSha256Hex(appSecret, rawBody))
}

/** Razorpay: X-Razorpay-Signature: <hex HMAC of the raw body with the webhook secret> */
export function verifyRazorpaySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false
  return safeEqual(header, hmacSha256Hex(secret, rawBody))
}

/** Google Ads lead forms: google_key in the body must equal the key set on the lead form asset. */
export function verifyGoogleKey(received: unknown, expected: string): boolean {
  return typeof received === 'string' && expected.length > 0 && safeEqual(received, expected)
}
