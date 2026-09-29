import * as Crypto from 'expo-crypto'
import { kvGet, kvSet } from './db'

/** Client-generated ids make every outbox retry idempotent (ADR-006). */
export const uuid = () => Crypto.randomUUID()

let cachedDeviceId: string | null = null

/** A stable per-install id, stored with every check-in and photo (BR-S3, 05-storage-media §2). */
export async function deviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  let id = await kvGet('device_id')
  if (!id) {
    id = `android-${uuid()}`
    await kvSet('device_id', id)
  }
  cachedDeviceId = id
  return id
}
