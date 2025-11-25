import { renderToString } from 'react-dom/server'
import React from 'react'

let Avatar: any

async function ensureAvatar() {
  if (!Avatar) {
    // Dynamic import to handle ESM module in CommonJS environment
    const module = await import('boring-avatars')
    Avatar = module.default
  }
}

export async function generateAvatar(seed: string, colors?: string[]): Promise<string> {
  await ensureAvatar()
  
  // boring-avatars is a React component, so we render it to a string
  // We use 'marble' variant as requested
  // Colors can be passed in to match the theme, or default to Zentrio red/dark theme
  const defaultColors = ['#e50914', '#141414', '#ffffff', '#333333', '#b3b3b3']
  
  const svg = renderToString(
    React.createElement(Avatar, {
      size: 120,
      name: seed,
      variant: 'marble',
      colors: colors || defaultColors,
    })
  )
  return svg
}

export async function generateRandomAvatar(colors?: string[]): Promise<{ svg: string; seed: string }> {
  const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const svg = await generateAvatar(randomSeed, colors)
  return { svg, seed: randomSeed }
}
