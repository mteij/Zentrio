let dicebearCore: any
let dicebearCollection: any
let dicebearLoaded = false

async function ensureDicebear() {
  if (!dicebearLoaded) {
    dicebearCore = await import('@dicebear/core')
    dicebearCollection = await import('@dicebear/collection')
    dicebearLoaded = true
  }
}

export async function generateAvatar(seed: string): Promise<string> {
  await ensureDicebear()
  const { createAvatar } = dicebearCore
  const { avataaarsNeutral } = dicebearCollection
  const avatar = createAvatar(avataaarsNeutral, { seed })
  return avatar.toString()
}

export async function generateRandomAvatar(): Promise<{ svg: string; seed: string }> {
  const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const svg = await generateAvatar(randomSeed)
  return { svg, seed: randomSeed }
}
