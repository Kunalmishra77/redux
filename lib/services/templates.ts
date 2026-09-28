// Fill a WhatsApp template's {{n}} placeholders from named variables, in the order the template
// declares them — the same order the Graph API body parameters are sent in (worker/notifications).
export function renderTemplate(body: string, declared: string[], values: Record<string, unknown>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const key = declared[Number(n) - 1]
    const v = key ? values[key] : undefined
    return v === undefined || v === null || v === '' ? '…' : String(v)
  })
}
