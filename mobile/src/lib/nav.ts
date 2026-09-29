import { Linking } from 'react-native'

/** D7-01: navigation to the property — hands off to Google Maps. */
export function openDirections(p: { lat: number | null; lng: number | null; address: string | null }) {
  const dest = p.lat !== null && p.lng !== null ? `${p.lat},${p.lng}` : encodeURIComponent(p.address ?? '')
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`)
}

export function callPhone(phone: string) {
  return Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`)
}
