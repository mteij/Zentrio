import { transliterate } from 'transliteration'

const MIDDLE_DOT_PATTERN = /[\u00b7\u0387\u2022\u2024\u2027\u2219\u22c5]/gu
const APOSTROPHE_PATTERN = /['’`]/gu
const COMBINING_MARKS_PATTERN = /\p{M}+/gu
const NON_WORD_PATTERN = /[^\p{L}\p{N}]+/gu
const LEADING_ARTICLE_PATTERN = /^(the|a|an)\s+/u

const DIGIT_TO_WORD = new Map([
  ['0', 'zero'],
  ['1', 'one'],
  ['2', 'two'],
  ['3', 'three'],
  ['4', 'four'],
  ['5', 'five'],
  ['6', 'six'],
  ['7', 'seven'],
  ['8', 'eight'],
  ['9', 'nine'],
  ['10', 'ten'],
  ['11', 'eleven'],
  ['12', 'twelve'],
  ['13', 'thirteen'],
  ['14', 'fourteen'],
  ['15', 'fifteen'],
  ['16', 'sixteen'],
  ['17', 'seventeen'],
  ['18', 'eighteen'],
  ['19', 'nineteen'],
  ['20', 'twenty'],
])

const ROMAN_TO_DIGIT = new Map([
  ['i', '1'],
  ['ii', '2'],
  ['iii', '3'],
  ['iv', '4'],
  ['v', '5'],
  ['vi', '6'],
  ['vii', '7'],
  ['viii', '8'],
  ['ix', '9'],
  ['x', '10'],
  ['xi', '11'],
  ['xii', '12'],
  ['xiii', '13'],
  ['xiv', '14'],
  ['xv', '15'],
  ['xvi', '16'],
  ['xvii', '17'],
  ['xviii', '18'],
  ['xix', '19'],
  ['xx', '20'],
])

const WORD_TO_DIGIT = new Map(
  Array.from(DIGIT_TO_WORD.entries()).map(([digit, word]) => [word, digit])
)

const DIGIT_TO_ROMAN = new Map(
  Array.from(ROMAN_TO_DIGIT.entries()).map(([roman, digit]) => [digit, roman])
)

function replaceSemanticSymbols(value: string): string {
  return value
    .replace(/&/gu, ' and ')
    .replace(/\+/gu, ' plus ')
    .replace(/@/gu, ' at ')
}

function normalizeBase(value: string): string {
  return transliterate(value)
    .normalize('NFKD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .replace(MIDDLE_DOT_PATTERN, ' ')
    .replace(APOSTROPHE_PATTERN, '')
    .replace(NON_WORD_PATTERN, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function tokenizeNormalized(value: string): string[] {
  return value.split(' ').filter(Boolean)
}

function transformTokens(tokens: string[], mapper: (token: string) => string): string | null {
  let changed = false

  const transformed = tokens.map((token) => {
    const next = mapper(token)
    if (next !== token) changed = true
    return next
  })

  if (!changed) return null
  return transformed.join(' ')
}

function addSurfaceForms(forms: Set<string>, value: string) {
  if (!value) return

  forms.add(value)
  forms.add(value.replace(/\s+/g, ''))
  forms.add(value.replace(/\s+/g, '-'))
  forms.add(value.replace(/\s+/g, '\u00b7'))
  forms.add(value.replace(/\band\b/g, '&'))
  forms.add(value.replace(/\bplus\b/g, '+'))
  forms.add(value.replace(/\bat\b/g, '@'))
}

function buildCompactSplitForms(value: string): string[] {
  if (!/^[a-z0-9]+$/u.test(value) || value.length < 5 || value.length > 12) {
    return []
  }

  const forms = new Set<string>()

  // Handle stylized titles like "walle" -> "wall e" and "se7en" -> "se 7 en" via later surface forms.
  for (let splitIndex = Math.max(3, value.length - 3); splitIndex < value.length; splitIndex++) {
    const left = value.slice(0, splitIndex)
    const right = value.slice(splitIndex)
    if (left.length >= 3 && right.length >= 1 && right.length <= 3) {
      forms.add(`${left} ${right}`)
    }
  }

  return Array.from(forms)
}

function buildCanonicalForms(value: string): string[] {
  const base = normalizeBase(replaceSemanticSymbols(value))
  if (!base) return []

  const tokens = tokenizeNormalized(base)
  const forms = new Set<string>([base])

  const digitForm = transformTokens(tokens, (token) => WORD_TO_DIGIT.get(token) || ROMAN_TO_DIGIT.get(token) || token)
  const wordForm = transformTokens(tokens, (token) => DIGIT_TO_WORD.get(token) || token)
  const romanForm = transformTokens(tokens, (token) => {
    const digit = WORD_TO_DIGIT.get(token) || token
    return DIGIT_TO_ROMAN.get(digit) || token
  })

  if (digitForm) forms.add(digitForm)
  if (wordForm) forms.add(wordForm)
  if (romanForm) forms.add(romanForm)
  forms.add(base.replace(LEADING_ARTICLE_PATTERN, ''))

  if (digitForm) {
    const digitTokens = tokenizeNormalized(digitForm)
    const digitWordForm = transformTokens(digitTokens, (token) => DIGIT_TO_WORD.get(token) || token)
    const digitRomanForm = transformTokens(digitTokens, (token) => DIGIT_TO_ROMAN.get(token) || token)
    if (digitWordForm) forms.add(digitWordForm)
    if (digitRomanForm) forms.add(digitRomanForm)
  }

  return Array.from(forms)
}

export function normalizeSearchText(value: string): string {
  return normalizeBase(replaceSemanticSymbols(value))
}

export function buildSearchQueryVariants(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const variants = new Set<string>([trimmed])
  const compactInput = normalizeSearchText(trimmed).replace(/\s+/g, '')
  const shouldAddCompactSplits = compactInput.length >= 5 && /^[a-z0-9]+$/u.test(trimmed.toLowerCase())

  for (const form of buildCanonicalForms(value)) {
    addSurfaceForms(variants, form)
    if (shouldAddCompactSplits) {
      for (const splitForm of buildCompactSplitForms(form.replace(/\s+/g, ''))) {
        addSurfaceForms(variants, splitForm)
      }
    }
  }

  return Array.from(variants).filter(Boolean)
}

export function scoreSearchMatch(name: string | undefined, query: string): number {
  if (!name) return 0

  const nameForms = buildCanonicalForms(name)
  const queryForms = buildCanonicalForms(query)

  if (nameForms.length === 0 || queryForms.length === 0) return 0

  let bestScore = 0

  for (const normalizedName of nameForms) {
    for (const normalizedQuery of queryForms) {
      if (normalizedName === normalizedQuery) {
        bestScore = Math.max(bestScore, 1000)
        continue
      }

      const compactName = normalizedName.replace(/\s+/g, '')
      const compactQuery = normalizedQuery.replace(/\s+/g, '')

      if (compactName === compactQuery) {
        bestScore = Math.max(bestScore, 975)
        continue
      }

      if (normalizedName.startsWith(normalizedQuery)) {
        bestScore = Math.max(bestScore, 850)
      }

      if (compactName.startsWith(compactQuery)) {
        bestScore = Math.max(bestScore, 800)
      }

      if (normalizedName.includes(normalizedQuery)) {
        bestScore = Math.max(bestScore, 700)
      }

      if (compactName.includes(compactQuery)) {
        bestScore = Math.max(bestScore, 650)
      }
    }
  }

  return bestScore
}
