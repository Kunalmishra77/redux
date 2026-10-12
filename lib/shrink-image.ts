// Resize an image to at most `max` px on the long side and re-encode as JPEG, in the browser — so an
// upload stays well under the request limits (server actions 1 MB, Vercel 4.5 MB) whatever the camera.
export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality))
  return { blob, width, height }
}
