// CR-001 phase 4 (D27) — words for the assessment decision, shared by staff and portal screens.
export const MODE_LABEL: Record<string, string> = { onsite: 'On-site survey', self: 'Self-assessment', video: 'Self-assessment + video call' }
export const DEMO_LABEL: Record<string, string> = { room_demo: 'Free room demo', fitting_demo: 'Free single-fitting demo', none: 'No demo' }
export const BAND_LABEL: Record<string, string> = { near: 'Inside the service area', far: 'Outside the service area', unknown: 'Location not known' }
export const SLOT_LABEL: Record<string, string> = { front: 'Front', side: 'Side', top: 'Top', close_up: 'Close-up' }
export const SLOTS = ['front', 'side', 'top', 'close_up'] as const
