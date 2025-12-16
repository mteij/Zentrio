import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'

export interface Theme {
  id: string
  name: string
  accent: string
  btnPrimary?: string
  btnPrimaryHover?: string
  text?: string
  muted?: string
  background?: {
    primary: string
    secondary: string
    tertiary: string
  }
  animationSpeed?: number
}

const THEMES_DIR = join(process.cwd(), 'src', 'themes')

async function ensureThemesDir() {
  try {
    await fs.mkdir(THEMES_DIR, { recursive: true })
  } catch (e) {
    // ignore
  }
}

export async function listThemes(): Promise<Theme[]> {
  await ensureThemesDir()
  try {
    const files = await fs.readdir(THEMES_DIR)
    const jsonFiles = files.filter(f => extname(f).toLowerCase() === '.json')
    const themes: Theme[] = []
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(join(THEMES_DIR, file), 'utf-8')
        const parsed = JSON.parse(content)
        const id = basename(file, '.json')
        themes.push(Object.assign({ id }, parsed))
      } catch (e) {
        // skip invalid files
        console.error('Failed to read theme file', file, e)
      }
    }
    return themes
  } catch (e) {
    return []
  }
}

export async function saveTheme(id: string, theme: Theme): Promise<void> {
  await ensureThemesDir()
  const safeId = id.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()
  const filePath = join(THEMES_DIR, `${safeId}.json`)
  await fs.writeFile(filePath, JSON.stringify(theme, null, 2), 'utf-8')
}

export default {
  listThemes,
  saveTheme
}