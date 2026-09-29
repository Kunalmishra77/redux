import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { db } from './db'
import { uuid } from './ids'
import type { DraftPhoto, Slot } from './repo'

// Photo pipeline (05-storage-media.md §2, D7-11). Compress AT CAPTURE, not at upload:
//   standard slots 1600 px long edge q0.72 · close_up 2048 px q0.80 (model/serial legibility).
// Written to the app's private document directory — never the gallery.

const SPEC: Record<Slot, { edge: number; q: number }> = {
  front: { edge: 1600, q: 0.72 },
  side: { edge: 1600, q: 0.72 },
  top: { edge: 1600, q: 0.72 },
  close_up: { edge: 2048, q: 0.8 },
}

export function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'photos')
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export type CaptureSource = 'camera' | 'library'

/** Returns null when the surveyor cancels. Throws a human-readable Error otherwise. */
export async function capturePhoto(slot: Slot, source: CaptureSource): Promise<DraftPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) throw new Error('Camera permission is off. Turn it on in Settings → Apps → Expo Go → Permissions.')
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]

  // Location for the photo row — best effort, never blocks (BR-S3 spirit: no signal is normal on site)
  const locP = Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null)

  const { edge, q } = SPEC[slot]
  const ctx = ImageManipulator.manipulate(asset.uri)
  const w = asset.width || edge
  const h = asset.height || edge
  if (Math.max(w, h) > edge) {
    if (w >= h) ctx.resize({ width: edge })
    else ctx.resize({ height: edge })
  }
  const rendered = await ctx.renderAsync()
  const saved = await rendered.saveAsync({ compress: q, format: SaveFormat.JPEG })

  // Move into app-private storage, then hash the exact bytes that will be uploaded
  const target = new File(photoDir(), `${uuid()}.jpg`)
  new File(saved.uri).copy(target)
  const bytes = await target.bytes()
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
  const loc = await locP

  try {
    new File(saved.uri).delete() // the cache copy; the document copy is the one we keep
  } catch {
    // cache is the OS's to clean
  }

  return {
    slot,
    local_uri: target.uri,
    sha256: toHex(digest),
    bytes: bytes.byteLength,
    width: saved.width,
    height: saved.height,
    lat: loc ? Number(loc.coords.latitude.toFixed(6)) : null,
    lng: loc ? Number(loc.coords.longitude.toFixed(6)) : null,
    accuracy_m: loc?.coords.accuracy ?? null,
    captured_at: new Date().toISOString(),
  }
}

/** A retake of an UNSAVED slot: the superseded draft file was never part of a saved fitting. */
export async function discardReplacedDraft(fittingId: string, slot: Slot, keepUri: string) {
  const old = await db.getFirstAsync<{ local_uri: string }>('SELECT local_uri FROM draft_photos WHERE fitting_id = ? AND slot = ?', fittingId, slot)
  if (old && old.local_uri !== keepUri) {
    try {
      const f = new File(old.local_uri)
      if (f.exists) f.delete()
    } catch {
      // harmless leftover
    }
  }
}

/**
 * Startup reconciler (D7-09). Counts photo files no local row refers to. They are KEPT — the app
 * never deletes a surveyor's photo on its own — and reported on the Sync screen.
 */
export async function reconcilePhotos(): Promise<{ orphans: number; bytes: number }> {
  const dir = photoDir()
  const known = new Set(
    (await db.getAllAsync<{ u: string }>(
      `SELECT local_uri AS u FROM attachments WHERE local_uri IS NOT NULL UNION SELECT local_uri FROM draft_photos`,
    )).map((r) => r.u),
  )
  let orphans = 0
  let size = 0
  for (const entry of dir.list()) {
    if (entry instanceof File && !known.has(entry.uri)) {
      orphans++
      size += entry.size ?? 0
    }
  }
  return { orphans, bytes: size }
}

export function freeSpaceMb(): number | null {
  try {
    return Math.round(Paths.availableDiskSpace / 1_048_576)
  } catch {
    return null
  }
}
