import { OFFICIAL_HOSTED_LEGAL_NOTICE, OFFICIAL_HOSTED_LEGAL_URLS } from "../../lib/legal"

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
  const alignmentClass = align === "left" ? "items-start text-left" : "items-center text-center"

  return (
    <div className={`flex flex-col gap-2 text-xs text-zinc-500 ${alignmentClass} ${className}`.trim()}>
      <p className="max-w-xl leading-5">{OFFICIAL_HOSTED_LEGAL_NOTICE}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={OFFICIAL_HOSTED_LEGAL_URLS.terms}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 transition-colors hover:text-white hover:underline"
        >
          Hosted Terms
        </a>
        <a
          href={OFFICIAL_HOSTED_LEGAL_URLS.privacy}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 transition-colors hover:text-white hover:underline"
        >
          Hosted Privacy
        </a>
        {showAccountDeletion ? (
          <a
            href={OFFICIAL_HOSTED_LEGAL_URLS.accountDeletion}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 transition-colors hover:text-white hover:underline"
          >
            Account Deletion
          </a>
        ) : null}
      </div>
    </div>
  )
}
