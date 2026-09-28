import { describe, expect, it } from 'vitest'
import {
  extractLeadgenIds,
  googleLeadSchema,
  mapGoogleLead,
  mapMetaLead,
  mapRazorpayPayment,
  mapWhatsAppLead,
  metaLeadSchema,
  parseWhatsAppWebhook,
} from '@/lib/integrations/payloads'
import { leadIntakeSchema } from '@/lib/validators/leads'

describe('Google Ads lead → intake', () => {
  const lead = googleLeadSchema.parse({
    lead_id: 'L-9',
    gcl_id: 'gclid-1',
    google_key: 'secret',
    user_column_data: [
      { column_id: 'FIRST_NAME', string_value: 'Asha' },
      { column_id: 'LAST_NAME', string_value: 'Verma' },
      { column_id: 'PHONE_NUMBER', string_value: '+91 98100 00009' },
      { column_id: 'EMAIL', string_value: 'asha@example.com' },
      { column_id: 'QUESTION_ROOMS', string_value: '42' },
    ],
  })

  it('maps standard columns and joins first + last name; BR-L1 phone ends up E.164', () => {
    const intake = leadIntakeSchema.parse(mapGoogleLead(lead))
    expect(intake).toMatchObject({
      source: 'google_ads', google_lead_id: 'L-9', phone: '+919810000009', name: 'Asha Verma', email: 'asha@example.com',
      utm: { gclid: 'gclid-1' },
    })
  })

  it('maps custom questions only through lead_form_field_map', () => {
    const intake = mapGoogleLead(lead, { QUESTION_ROOMS: 'property_name' })
    expect(intake.property_name).toBe('42')
    expect(mapGoogleLead(lead).property_name).toBeUndefined()
  })

  it('drops google_key from the stored payload', () => {
    expect(JSON.stringify(mapGoogleLead(lead).raw_payload)).not.toContain('secret')
  })
})

describe('Meta lead ads', () => {
  it('extracts every leadgen id from a batched delivery', () => {
    const body = {
      object: 'page',
      entry: [
        { changes: [{ field: 'leadgen', value: { leadgen_id: '111', form_id: 'F' } }, { field: 'feed', value: {} }] },
        { changes: [{ field: 'leadgen', value: { leadgen_id: 222 } }] },
      ],
    }
    expect(extractLeadgenIds(body)).toEqual(['111', '222'])
    expect(extractLeadgenIds({ nonsense: true })).toEqual([])
  })

  it('maps field_data; custom (auto-slugged) questions only via the map', () => {
    const lead = metaLeadSchema.parse({
      id: 'LG-1', ad_id: 'AD-1', form_id: 'F-1',
      field_data: [
        { name: 'full_name', values: ['Rohit Mehra'] },
        { name: 'phone_number', values: ['09810000011'] },
        { name: 'how_many_bathrooms?', values: ['2'] },
      ],
    })
    const intake = leadIntakeSchema.parse(mapMetaLead(lead, { 'how_many_bathrooms?': 'enquirer_role' }))
    expect(intake).toMatchObject({
      source: 'meta_lead_ad', meta_leadgen_id: 'LG-1', meta_ad_id: 'AD-1', meta_form_id: 'F-1',
      name: 'Rohit Mehra', phone: '+919810000011', enquirer_role: '2',
    })
  })
})

describe('WhatsApp webhook', () => {
  const body = {
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          contacts: [{ wa_id: '919810000021', profile: { name: 'Neha' } }],
          messages: [{
            id: 'wamid.IN1', from: '919810000021', timestamp: '1760000000', type: 'text',
            text: { body: 'Hi, my tap leaks' },
            referral: { source_id: 'AD-77', source_type: 'ad', ctwa_clid: 'CLID-1' },
          }],
          statuses: [
            { id: 'wamid.OUT1', status: 'delivered', timestamp: '1760000001' },
            { id: 'wamid.OUT1', status: 'read', timestamp: '1760000002' },
          ],
        },
      }],
    }],
  }

  it('flattens messages and every status (item 7: delivered and read for one wamid are both kept)', () => {
    const { messages, statuses } = parseWhatsAppWebhook(body)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ wamid: 'wamid.IN1', waId: '919810000021', profileName: 'Neha', body: 'Hi, my tap leaks' })
    expect(statuses.map((s) => s.status)).toEqual(['delivered', 'read'])
  })

  it('a CTWA first message becomes a lead with ctwa_clid captured at creation (BR-L3)', () => {
    const { messages } = parseWhatsAppWebhook(body)
    const intake = leadIntakeSchema.parse(mapWhatsAppLead(messages[0]!, false))
    expect(intake).toMatchObject({ source: 'whatsapp_chat', phone: '+919810000021', ctwa_clid: 'CLID-1', meta_ad_id: 'AD-77', name: 'Neha' })
  })

  it('a reply to one of our campaigns is attributed to the campaign', () => {
    const { messages } = parseWhatsAppWebhook(body)
    expect(mapWhatsAppLead(messages[0]!, true).source).toBe('whatsapp_campaign')
  })
})

describe('Razorpay payment → record_payment()', () => {
  it('converts paise to a decimal string — never a float — and reads the invoice id from notes', () => {
    const p = mapRazorpayPayment({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_9', amount: 12345650, status: 'captured', method: 'upi', created_at: 1760000000, notes: { invoice_id: 'inv-1' } } } },
    })
    expect(p).toEqual({
      invoiceId: 'inv-1', providerPaymentId: 'pay_9', amount: '123456.50', status: 'captured', method: 'upi',
      capturedAt: new Date(1760000000 * 1000).toISOString(),
    })
  })

  it('an authorized payment is not yet money in (created)', () => {
    const p = mapRazorpayPayment({ event: 'payment.authorized', payload: { payment: { entity: { id: 'pay_1', amount: 100, status: 'authorized' } } } })
    expect(p?.status).toBe('created')
  })

  it('an event without a payment is not a payment', () => {
    expect(mapRazorpayPayment({ event: 'settlement.processed', payload: {} })).toBeNull()
  })
})
