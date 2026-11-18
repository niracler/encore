import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { createTranslator } from './i18n.mjs'

// Default `keep = true`: extract embedded images to WebP beside session.json with dimensions and smart fallback labels.
export async function extractImages(session, directory, { keep = true, width = 960, lang = 'zh' } = {}) {
  const t = createTranslator(lang)
  const names = new Map()
  const frames = []
  let refCount = 0
  let aiCount = 0

  for (const item of session.items || []) {
    if (!item.images) continue
    if (!keep) {
      delete item.images
      continue
    }
    const files = []
    for (const image of item.images) {
      if (typeof image === 'string') {
        files.push(image)
        continue
      }
      const data = Buffer.from(image.base64, 'base64')
      const hash = createHash('sha256').update(data).digest('hex').slice(0, 12)
      if (!names.has(hash)) {
        const name = `${hash}.webp`
        mkdirSync(directory, { recursive: true })
        let info
        try {
          info = await sharp(data)
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(join(directory, name))
        } catch {
          continue
        }
        names.set(hash, name)
        const who = item.type === 'user' ? 'you' : 'ai'
        const label = who === 'you'
          ? t('defaultRefFrame', { n: ++refCount })
          : t('defaultAiFrame', { n: ++aiCount })
        frames.push({
          time: item.time,
          img: name,
          who,
          label,
          ...(info?.width ? { w: info.width } : {}),
          ...(info?.height ? { h: info.height } : {}),
        })
      }
      files.push(names.get(hash))
    }
    item.images = [...new Set(files)]
  }
  if (keep && frames.length) {
    session.frames = frames
  }
  return session
}
