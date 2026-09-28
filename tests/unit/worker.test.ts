import { describe, expect, it } from 'vitest'
import { createGraphClient, GraphError } from '@/lib/integrations/meta-graph'
import { templateParams } from '../../worker/processors/notifications'

describe('WhatsApp template parameters', () => {
  it('follow the order the template declares, whatever order the variables were stored in', () => {
    expect(templateParams(['date', 'slot', 'surveyor'], { surveyor: 'Ankit', date: '12 Oct 2026', slot: '11:00–13:00' }))
      .toEqual(['12 Oct 2026', '11:00–13:00', 'Ankit'])
  })

  it('an unset variable is an empty string, never "undefined"', () => {
    expect(templateParams(['name'], {})).toEqual([''])
    expect(templateParams(null, { a: 1 })).toEqual([])
  })
})

describe('Graph API client', () => {
  const fakeFetch = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('returns the wamid of a sent template', async () => {
    const graph = createGraphClient({ version: 'v25.0', accessToken: 't', fetchImpl: fakeFetch(200, { messages: [{ id: 'wamid.X' }] }) })
    await expect(graph.sendTemplate('PNID', '919810000001', 'survey_booked', 'en', ['a'])).resolves.toBe('wamid.X')
  })

  it('a 4XX (bad template, bad token) is permanent; a 429 or 5XX is retryable', async () => {
    const bad = createGraphClient({ version: 'v25.0', accessToken: 't', fetchImpl: fakeFetch(400, { error: { message: 'Template name does not exist' } }) })
    const err400 = await bad.getLead('1').catch((e: unknown) => e)
    expect(err400).toBeInstanceOf(GraphError)
    expect((err400 as GraphError).retryable).toBe(false)
    expect((err400 as GraphError).message).toBe('Template name does not exist')

    const busy = createGraphClient({ version: 'v25.0', accessToken: 't', fetchImpl: fakeFetch(429, {}) })
    expect(((await busy.getLead('1').catch((e: unknown) => e)) as GraphError).retryable).toBe(true)
  })

  it('sends the token only in the Authorization header, never in the URL', async () => {
    const seen: { url: string; auth: string | null }[] = []
    const spy = (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get('authorization') })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    await createGraphClient({ version: 'v25.0', accessToken: 'SECRET-TOKEN', fetchImpl: spy }).getLead('123')
    expect(seen[0]?.url).not.toContain('SECRET-TOKEN')
    expect(seen[0]?.auth).toBe('Bearer SECRET-TOKEN')
  })
})
