#!/usr/bin/env node
/**
 * Derives the app icon, the Apple touch icon and the social preview from the
 * brand logo, so they never drift apart.
 *
 *   npm run icons
 *
 * The source lockup carries its own dark background, which is why every output
 * here sits on a dark canvas: on a light surface it would show as a murky
 * square.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const lockupSource = resolve(root, 'src/assets/logo_fluentia.png')
const markSource = resolve(root, 'src/assets/F.png')
const appDir = resolve(root, 'src/app')

/** Matches the darkest edge of the logo, so composites have no visible seam. */
const CANVAS = { r: 7, g: 7, b: 15, alpha: 1 }

mkdirSync(appDir, { recursive: true })

const onCanvas = (size) =>
  sharp({ create: { width: size, height: size, channels: 4, background: CANVAS } })

/*
 * Favicon and PWA icon, built from the F mark rather than the full lockup: a
 * browser tab renders this at 16 pixels, where a wordmark is an unreadable
 * smear. The mark ships transparent, so it sits on the dark tile here.
 */
const MARK_BOX = { left: 126, top: 89, width: 1021, height: 1117 }

const icon = async (size) => {
  const inner = Math.round(size * 0.66)
  const mark = await sharp(markSource)
    .extract(MARK_BOX)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  return onCanvas(size)
    .composite([{ input: mark, gravity: 'center' }])
    // Palette PNG: the mark is a smooth gradient, which stores badly as
    // truecolour. A browser downloads this for every tab.
    .png({ compressionLevel: 9, palette: true, quality: 92 })
}

await (await icon(512)).toFile(resolve(appDir, 'icon.png'))
await (await icon(180)).toFile(resolve(appDir, 'apple-icon.png'))

/* The UI mark: transparent, square, used at 32px in the header and sidebar. */
await sharp(markSource)
  .extract(MARK_BOX)
  .resize(224, 224, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({
    top: 16,
    bottom: 16,
    left: 16,
    right: 16,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(resolve(root, 'src/assets/logo-mark.webp'))

/*
 * Social preview: the square lockup on a wide card.
 *
 * The backdrop is the same logo blown up and blurred rather than a flat colour.
 * A flat fill leaves a visible rectangle where the logo's own dark background
 * ends; bleeding the artwork outwards hides that seam completely.
 */
const OG = { width: 1200, height: 630 }

const backdrop = await sharp(lockupSource)
  .resize(OG.width, OG.width, { fit: 'cover' })
  .extract({ left: 0, top: (OG.width - OG.height) >> 1, width: OG.width, height: OG.height })
  .blur(60)
  .modulate({ brightness: 0.55 })
  .toBuffer()

/*
 * The lockup's own background is a semi-transparent square, so dropping it
 * straight on the backdrop leaves a faint rectangle. Feathering its edges to
 * nothing makes the artwork sit in the card instead of on top of it.
 */
const SIZE = 560
const feather = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}">
     <defs>
       <radialGradient id="f" cx="50%" cy="50%" r="50%">
         <stop offset="62%" stop-color="#fff" stop-opacity="1"/>
         <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
       </radialGradient>
     </defs>
     <rect width="${SIZE}" height="${SIZE}" fill="url(#f)"/>
   </svg>`,
)

const logo = await sharp(lockupSource)
  .resize(SIZE, SIZE)
  .composite([{ input: feather, blend: 'dest-in' }])
  .toBuffer()

await sharp({
  create: { width: OG.width, height: OG.height, channels: 4, background: CANVAS },
})
  .composite([{ input: backdrop }, { input: logo, gravity: 'center' }])
  // JPEG rather than PNG: this is photographic artwork, and a social card that
  // weighs half a megabyte is a slow preview on every shared link.
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(resolve(appDir, 'opengraph-image.jpg'))

/*
 * The lockup with its background lifted out.
 *
 * The artwork is bright and the background is dark, so brightness doubles as a
 * matte: alpha comes from the strongest colour channel — perceptual luminance
 * would desaturate the blues, which barely register in it — and the colour is
 * un-premultiplied to reconstruct exactly what sat on black. `FLOOR` then drops
 * the ambient haze in the corners, which is bright enough to survive the key.
 *
 * The floor is high enough to clear the ambient blue in the lower corner, which
 * survives a gentler key. The result is transparent, so it sits on a dark panel
 * with no visible square.
 * It still expects a dark surface: the mascot's visor is dark by design, and on
 * a light background it would disappear.
 */
const FLOOR = 95

const { data, info } = await sharp(lockupSource)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const keyed = Buffer.alloc(info.width * info.height * 4)

for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
  const a = data[i + 3] / 255
  const r = data[i] * a
  const g = data[i + 1] * a
  const b = data[i + 2] * a

  const peak = Math.max(r, g, b)
  const lifted = (peak - FLOOR) / (255 - FLOOR)

  if (lifted <= 0) continue // leaves the pixel fully transparent

  const scale = 255 / peak
  keyed[j] = Math.min(255, Math.round(r * scale))
  keyed[j + 1] = Math.min(255, Math.round(g * scale))
  keyed[j + 2] = Math.min(255, Math.round(b * scale))
  keyed[j + 3] = Math.round(255 * Math.min(1, lifted))
}

/*
 * The corner still holds a patch of ambient blue that is bright enough to pass
 * the floor. Raising the floor further would eat the artwork's own halo, so it
 * is filtered by position instead: keep faint pixels only where they sit near
 * something solid. A blurred mask of the solid pixels gives that proximity.
 */
const SOLID = 140
const solidMask = Buffer.alloc(info.width * info.height)
for (let p = 0; p < solidMask.length; p += 1) {
  solidMask[p] = keyed[p * 4 + 3] >= SOLID ? 255 : 0
}

// Blurring a single-channel buffer hands back three channels, so the stride
// comes from the result rather than from the input.
const proximity = await sharp(solidMask, {
  raw: { width: info.width, height: info.height, channels: 1 },
})
  .blur(30)
  .raw()
  .toBuffer({ resolveWithObject: true })

const stride = proximity.info.channels

for (let p = 0; p < info.width * info.height; p += 1) {
  // Reaches full strength close to the artwork and falls away from it.
  const near = Math.min(1, proximity.data[p * stride] / 24)
  keyed[p * 4 + 3] = Math.round(keyed[p * 4 + 3] * near)
}

await sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })
  .resize(680, 680, { fit: 'inside' })
  // Breathing room, so the wordmark never touches the edge of its box.
  .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile(resolve(root, 'src/assets/logo-lockup.webp'))

console.log('Generated icon.png, apple-icon.png, opengraph-image.jpg, logo-mark.webp and logo-lockup.webp')
