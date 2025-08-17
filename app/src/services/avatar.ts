import { createAvatar } from '@dicebear/core'
import { avataaarsNeutral } from '@dicebear/collection'

export function generateAvatar(seed: string): string {
  const avatar = createAvatar(avataaarsNeutral, {
    seed: seed
  })
  return avatar.toString()
}

export function generateRandomAvatar(): { svg: string, seed: string } {
  const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const svg = generateAvatar(randomSeed)
  return { svg, seed: randomSeed }
}