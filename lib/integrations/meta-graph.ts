// Minimal Meta Graph API client (lead retrieval, WhatsApp template send, CAPI). Framework-free and
// fetch-injected, so the worker uses it and tests stub it. Version pinned by META_GRAPH_VERSION.

export type GraphConfig = {
  version: string            // 'v25.0'
  accessToken: string        // system user token — never logged
  fetchImpl?: typeof fetch
}

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message)
  }
}

export function createGraphClient({ version, accessToken, fetchImpl = fetch }: GraphConfig) {
  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const res = await fetchImpl(`https://graph.facebook.com/${version}/${path}`, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = (data as { error?: { message?: string } })?.error?.message ?? `Graph API ${res.status}`
      // 4XX from Graph (bad template, bad token) will not fix itself; 429 and 5XX might
      throw new GraphError(message, res.status, res.status === 429 || res.status >= 500)
    }
    return data
  }

  return {
    /** D3: the leadgen webhook carries no PII — fetch the lead. */
    getLead: (leadgenId: string) =>
      call('GET', `${encodeURIComponent(leadgenId)}?fields=id,ad_id,form_id,campaign_id,created_time,field_data`),

    /** D3-04 reconciliation: leads on a form since a unix time. */
    listFormLeads: async (formId: string, sinceUnix: number) => {
      const filtering = encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix }]))
      const data = (await call('GET', `${encodeURIComponent(formId)}/leads?fields=id,ad_id,form_id,campaign_id,field_data&filtering=${filtering}&limit=100`)) as { data?: unknown[] }
      return data.data ?? []
    },

    /** An approved utility/authentication template; returns the wamid. */
    sendTemplate: async (phoneNumberId: string, to: string, template: string, language: string, params: string[]) => {
      const data = (await call('POST', `${encodeURIComponent(phoneNumberId)}/messages`, {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [],
        },
      })) as { messages?: { id?: string }[] }
      const wamid = data.messages?.[0]?.id
      if (!wamid) throw new GraphError('WhatsApp accepted the request but returned no message id', 502, true)
      return wamid
    },

    /** D3-06: CTWA conversion to the WhatsApp conversions dataset (research §2 "CAPI"). */
    sendCapiEvent: (datasetId: string, event: Record<string, unknown>) => call('POST', `${encodeURIComponent(datasetId)}/events`, { data: [event] }),
  }
}

export type GraphClient = ReturnType<typeof createGraphClient>
