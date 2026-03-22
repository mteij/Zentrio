const DEFAULT_OFFICIAL_HOSTED_APP_HOSTNAMES: string[] = []

const DEFAULT_OFFICIAL_HOSTED_LEGAL_URLS = {
  terms: "",
  privacy: "",
  accountDeletion: "",
} as const

const DEFAULT_OFFICIAL_HOSTED_LEGAL_LABELS = {
  terms: "Terms",
  privacy: "Privacy",
  accountDeletion: "Account Deletion",
} as const

const DEFAULT_OFFICIAL_HOSTED_LEGAL_NOTICE = ""

interface HostedLegalEnv {
  VITE_LEGAL_NOTICE_HOSTNAMES?: string
  VITE_LEGAL_NOTICE_TEXT?: string
  VITE_LEGAL_TERMS_URL?: string
  VITE_LEGAL_PRIVACY_URL?: string
  VITE_LEGAL_ACCOUNT_DELETION_URL?: string
  VITE_LEGAL_TERMS_LABEL?: string
  VITE_LEGAL_PRIVACY_LABEL?: string
  VITE_LEGAL_ACCOUNT_DELETION_LABEL?: string
}

interface HostedLegalConfig {
  appHostnames: string[]
  notice: string
  urls: {
    terms: string
    privacy: string
    accountDeletion: string
  }
  labels: {
    terms: string
    privacy: string
    accountDeletion: string
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase()
}

function readEnvOverride(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback
  }

  return value.trim()
}

function parseHostnameList(value: string | undefined): string[] {
  if (value === undefined) {
    return [...DEFAULT_OFFICIAL_HOSTED_APP_HOSTNAMES]
  }

  return [...new Set(value.split(",").map(normalizeHostname).filter(Boolean))]
}

export function resolveHostedLegalConfig(env: HostedLegalEnv = {}): HostedLegalConfig {
  return {
    appHostnames: parseHostnameList(env.VITE_LEGAL_NOTICE_HOSTNAMES),
    notice: readEnvOverride(env.VITE_LEGAL_NOTICE_TEXT, DEFAULT_OFFICIAL_HOSTED_LEGAL_NOTICE),
    urls: {
      terms: readEnvOverride(env.VITE_LEGAL_TERMS_URL, DEFAULT_OFFICIAL_HOSTED_LEGAL_URLS.terms),
      privacy: readEnvOverride(env.VITE_LEGAL_PRIVACY_URL, DEFAULT_OFFICIAL_HOSTED_LEGAL_URLS.privacy),
      accountDeletion: readEnvOverride(
        env.VITE_LEGAL_ACCOUNT_DELETION_URL,
        DEFAULT_OFFICIAL_HOSTED_LEGAL_URLS.accountDeletion
      ),
    },
    labels: {
      terms: readEnvOverride(env.VITE_LEGAL_TERMS_LABEL, DEFAULT_OFFICIAL_HOSTED_LEGAL_LABELS.terms),
      privacy: readEnvOverride(env.VITE_LEGAL_PRIVACY_LABEL, DEFAULT_OFFICIAL_HOSTED_LEGAL_LABELS.privacy),
      accountDeletion: readEnvOverride(
        env.VITE_LEGAL_ACCOUNT_DELETION_LABEL,
        DEFAULT_OFFICIAL_HOSTED_LEGAL_LABELS.accountDeletion
      ),
    },
  }
}

const hostedLegalConfig = resolveHostedLegalConfig(import.meta.env)

export const OFFICIAL_HOSTED_APP_HOSTNAMES = hostedLegalConfig.appHostnames
export const OFFICIAL_HOSTED_LEGAL_NOTICE = hostedLegalConfig.notice
export const OFFICIAL_HOSTED_LEGAL_URLS = hostedLegalConfig.urls
export const OFFICIAL_HOSTED_LEGAL_LABELS = hostedLegalConfig.labels

export function shouldShowOfficialHostedLegalNotice(hostname?: string): boolean {
  const currentHostname = hostname
    ? normalizeHostname(hostname)
    : typeof window !== "undefined"
      ? normalizeHostname(window.location.hostname)
      : ""

  if (!currentHostname) {
    return false
  }

  return OFFICIAL_HOSTED_APP_HOSTNAMES.includes(currentHostname)
}
