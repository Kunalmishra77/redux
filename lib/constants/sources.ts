// Lead sources: label + the coloured dot (B6). Plain module — shared by server and client
// components (a 'use client' module's exports reach the server only as client references).
export const SOURCES: Record<string, { label: string; dot: string }> = {
  website: { label: 'Website', dot: 'bg-redux-blue' },
  dealer: { label: 'Dealer', dot: 'bg-[#7A4FD1]' },
  meta_lead_ad: { label: 'Meta', dot: 'bg-[#1877F2]' },
  whatsapp_chat: { label: 'WhatsApp', dot: 'bg-whatsapp' },
  whatsapp_campaign: { label: 'WA campaign', dot: 'bg-[#128C7E]' },
  google_ads: { label: 'Google', dot: 'bg-[#EA4335]' },
  call: { label: 'Call', dot: 'bg-ink' },
  walk_in: { label: 'Walk-in', dot: 'bg-faint' },
}
