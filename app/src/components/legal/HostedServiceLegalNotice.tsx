import {
  OFFICIAL_HOSTED_LEGAL_LABELS,
  OFFICIAL_HOSTED_LEGAL_NOTICE,
  OFFICIAL_HOSTED_LEGAL_URLS,
  shouldShowOfficialHostedLegalNotice,
} from "../../lib/legal"

interface HostedServiceLegalNoticeProps {
  className?: string
  align?: "left" | "center"
  showAccountDeletion?: boolean
}

export function HostedServiceLegalNotice({
  className = "",
  align = "center",
  showAccountDeletion = false,
}: HostedServiceLegalNoticeProps) {
  if (!shouldShowOfficialHostedLegalNotice()) {
    return null
  }

  const legalLinks = [
    {
      href: OFFICIAL_HOSTED_LEGAL_URLS.terms,
      label: OFFICIAL_HOSTED_LEGAL_LABELS.terms,
    },
    {
      href: OFFICIAL_HOSTED_LEGAL_URLS.privacy,
      label: OFFICIAL_HOSTED_LEGAL_LABELS.privacy,
    },
    ...(showAccountDeletion
      ? [
          {
            href: OFFICIAL_HOSTED_LEGAL_URLS.accountDeletion,
            label: OFFICIAL_HOSTED_LEGAL_LABELS.accountDeletion,
          },
        ]
      : []),
  ].filter((link) => link.href && link.label)

  if (!OFFICIAL_HOSTED_LEGAL_NOTICE && legalLinks.length === 0) {
    return null
  }

  const alignmentClass = align === "left" ? "items-start text-left" : "items-center text-center"

  return (
    <div className={`flex flex-col gap-2 text-xs text-zinc-500 ${alignmentClass} ${className}`.trim()}>
      {OFFICIAL_HOSTED_LEGAL_NOTICE ? <p className="max-w-xl leading-5">{OFFICIAL_HOSTED_LEGAL_NOTICE}</p> : null}
      {legalLinks.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {legalLinks.map((link) => (
            <a
              key={`${link.label}:${link.href}`}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 transition-colors hover:text-white hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
