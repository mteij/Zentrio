/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'

export async function getLanguages(tmdbClient: TMDBClient) {
  const [primaryTranslations, languages] = await Promise.all([
    tmdbClient.primaryTranslations(),
    tmdbClient.languages(),
  ])
  return primaryTranslations.map((element: string) => {
    const [language, country] = element.split("-")
    const findLanguage = languages.find((obj: any) => obj.iso_639_1 === language)
    return { iso_639_1: element, name: findLanguage?.english_name || element }
  })
}