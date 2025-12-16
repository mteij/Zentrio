import { createAvatar } from '@dicebear/core'
import * as collection from '@dicebear/collection'

// Supported DiceBear avatar styles
export const AVATAR_STYLES = {
  'adventurer-neutral': collection.adventurerNeutral,
  'avataaars-neutral': collection.avataaarsNeutral,
  'bottts-neutral': collection.botttsNeutral,
  'glass': collection.glass,
  'fun-emoji': collection.funEmoji,
  'lorelei-neutral': collection.loreleiNeutral,
  'pixel-art-neutral': collection.pixelArtNeutral,
  'thumbs': collection.thumbs,
} as const

export type AvatarStyle = keyof typeof AVATAR_STYLES
export const DEFAULT_AVATAR_STYLE: AvatarStyle = 'bottts-neutral'

// Style display names for UI
export const AVATAR_STYLE_NAMES: Record<AvatarStyle, string> = {
  'adventurer-neutral': 'Adventurer',
  'avataaars-neutral': 'Avataaars',
  'bottts-neutral': 'Bottts',
  'glass': 'Glass',
  'fun-emoji': 'Fun Emoji',
  'lorelei-neutral': 'Lorelei',
  'pixel-art-neutral': 'Pixel Art',
  'thumbs': 'Thumbs',
}

export function generateAvatar(seed: string, style: AvatarStyle = DEFAULT_AVATAR_STYLE): string {
  const styleModule = AVATAR_STYLES[style] || AVATAR_STYLES[DEFAULT_AVATAR_STYLE]
  
  const avatar = createAvatar(styleModule as any, {
    seed,
    size: 120,
  })
  
  return avatar.toString()
}

export function generateRandomAvatar(style: AvatarStyle = DEFAULT_AVATAR_STYLE): { svg: string; seed: string } {
  const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const svg = generateAvatar(randomSeed, style)
  return { svg, seed: randomSeed }
}

export function isValidAvatarStyle(style: string): style is AvatarStyle {
  return style in AVATAR_STYLES
}
