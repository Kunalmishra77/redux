import { describe, expect, it } from 'vitest'
import { hmacSha256Hex, sha256Hex, verifyMetaSignature, verifyRazorpaySignature } from '@/lib/integrations/signature'
import {
  handleGoogleAds,
  handleMetaPost,
  handleMetaVerification,
  handleRazorpay,
  type RecordWebhook,
  type WebhookSource,
} from '@/lib/webhooks/handlers'

type Recorded = { source: WebhookSource; externalId: string; eventType: string | null; payload: unknown; signatureOk: boolean }

function recorder(fail = false): { record: RecordWebhook; calls: Recorded[] } {
  const calls: Recorded[] = []
  return {
    calls,
    record: async (source, externalId, eventType, payload, signatureOk) => {
      if (fail) throw new Error('db down')
      calls.push({ source, externalId, eventType, payload, signatureOk })
    },
  }
}

const SECRET = 'test-app-secret'

describe('signatures (ADR-008: raw body, timing-safe)', () => {
  it('accepts the HMAC of the exact raw body and nothing else', () => {
    const raw = '{"object":"page","entry":[]}'
    const header = `sha256=${hmacSha256Hex(SECRET, raw)}`
    expect(verifyMetaSignature(raw, header, SECRET)).toBe(true)
    expect(verifyMetaSignature(raw + ' ', header, SECRET)).toBe(false) // re-serialised JSON would fail
    expect(verifyMetaSignature(raw, header, 'other-secret')).toBe(false)
    expect(verifyMetaSignature(raw, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, hmacSha256Hex(SECRET, raw), SECRET)).toBe(false) // missing sha256= prefix
  })

  it('never verifies against an empty secret (a missing env var must not open the door)', () => {
    expect(verifyMetaSignature('x', `sha256=${hmacSha256Hex('', 'x')}`, '')).toBe(false)
    expect(verifyRazorpaySignature('x', hmacSha256Hex('', 'x'), '')).toBe(false)
  })
})

describe('Meta / WhatsApp webhook', () => {
  it('answers the subscription handshake only with the right token', () => {
    const ok = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '42' })
    expect(handleMetaVerification(ok, 'tok')).toMatchObject({ status: 200, body: '42' })
    expect(handleMetaVerification(ok, 'other')).toMatchObject({ status: 403 })
    expect(handleMetaVerification(ok, '')).toMatchObject({ status: 403 })
  })

  it('stores a signed delivery, keyed on the body hash (item 7), and answers 200', async () => {
    const raw = '{"object":"page","entry":[{"changes":[{"field":"leadgen","value":{"leadgen_id":"1"}}]}]}'
    const { record, calls } = recorder()
    const reply = await handleMetaPost('meta_leadgen', raw, `sha256=${hmacSha256Hex(SECRET, raw)}`, SECRET, record)
    expect(reply.status).toBe(200)
    expect(calls).toEqual([
      { source: 'meta_leadgen', externalId: sha256Hex(raw), eventType: 'leadgen', payload: JSON.parse(raw), signatureOk: true },
    ])
  })

  it('refuses a forged delivery and stores nothing', async () => {
    const { record, calls } = recorder()
    expect((await handleMetaPost('whatsapp', '{}', 'sha256=deadbeef', SECRET, record)).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('answers 5XX when the database is down, so Meta redelivers', async () => {
    const raw = '{}'
    const { record } = recorder(true)
    expect((await handleMetaPost('whatsapp', raw, `sha256=${hmacSha256Hex(SECRET, raw)}`, SECRET, record)).status).toBe(500)
  })
})

describe('Google Ads webhook — CLAUDE.md rule 6: never a 4XX', () => {
  const lead = { lead_id: 'L-1', google_key: 'k3y', user_column_data: [{ column_id: 'PHONE_NUMBER', string_value: '9810000001' }] }

  it('answers 200 {} and stores the lead keyed on lead_id', async () => {
    const { record, calls } = recorder()
    const reply = await handleGoogleAds(JSON.stringify(lead), 'k3y', record)
    expect(reply).toMatchObject({ status: 200, body: '{}' })
    expect(calls[0]).toMatchObject({ source: 'google_ads', externalId: 'L-1', signatureOk: true })
  })

  it('never stores the shared google_key', async () => {
    const { record, calls } = recorder()
    await handleGoogleAds(JSON.stringify(lead), 'k3y', record)
    expect(JSON.stringify(calls[0]?.payload)).not.toContain('k3y')
  })

  it('a wrong key is still 200 — kept for audit, flagged unverified', async () => {
    const { record, calls } = recorder()
    expect((await handleGoogleAds(JSON.stringify(lead), 'different', record)).status).toBe(200)
    expect(calls[0]?.signatureOk).toBe(false)
  })

  it('garbage is still 200, never 400', async () => {
    const { record } = recorder()
    expect((await handleGoogleAds('not json at all', 'k3y', record)).status).toBe(200)
  })

  it('only a database failure answers 5XX (Google retries 5XX)', async () => {
    const { record } = recorder(true)
    const reply = await handleGoogleAds(JSON.stringify(lead), 'k3y', record)
    expect(reply.status).toBe(500)
    expect(reply.status).not.toBeLessThan(500)
  })
})

describe('Razorpay webhook', () => {
  const raw = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1"}}}}'

  it('keys on X-Razorpay-Event-Id so authorized and captured are two events (item 7)', async () => {
    const { record, calls } = recorder()
    const sig = hmacSha256Hex(SECRET, raw)
    expect((await handleRazorpay(raw, sig, 'evt_A', SECRET, record)).status).toBe(200)
    expect(calls[0]).toMatchObject({ source: 'razorpay', externalId: 'evt_A', eventType: 'payment.captured' })
  })

  it('refuses a forged payment event (BR-I5)', async () => {
    const { record, calls } = recorder()
    expect((await handleRazorpay(raw, 'forged', 'evt_B', SECRET, record)).status).toBe(401)
    expect(calls).toHaveLength(0)
  })
})
