import { describe, expect, it } from "vitest"
import { resolveHostedLegalConfig, shouldShowOfficialHostedLegalNotice } from "./legal"

describe("resolveHostedLegalConfig", () => {
  it("defaults to hiding the legal notice until hostnames are configured", () => {
    expect(resolveHostedLegalConfig()).toEqual({
      appHostnames: [],
      notice: "",
      urls: {
        terms: "",
        privacy: "",
        accountDeletion: "",
      },
      labels: {
        terms: "Terms",
        privacy: "Privacy",
        accountDeletion: "Account Deletion",
      },
    })
    expect(shouldShowOfficialHostedLegalNotice("app.zentrio.eu")).toBe(false)
  })

  it("allows self-hosters to override hostnames, copy, labels, and urls through env", () => {
    expect(
      resolveHostedLegalConfig({
        VITE_LEGAL_NOTICE_HOSTNAMES: "media.example.com, portal.example.com, media.example.com",
        VITE_LEGAL_NOTICE_TEXT: "These links apply to this deployment.",
        VITE_LEGAL_TERMS_URL: "https://example.com/terms",
        VITE_LEGAL_PRIVACY_URL: "https://example.com/privacy",
        VITE_LEGAL_ACCOUNT_DELETION_URL: "",
        VITE_LEGAL_TERMS_LABEL: "Terms",
        VITE_LEGAL_PRIVACY_LABEL: "Privacy",
        VITE_LEGAL_ACCOUNT_DELETION_LABEL: "Delete Account",
      })
    ).toEqual({
      appHostnames: ["media.example.com", "portal.example.com"],
      notice: "These links apply to this deployment.",
      urls: {
        terms: "https://example.com/terms",
        privacy: "https://example.com/privacy",
        accountDeletion: "",
      },
      labels: {
        terms: "Terms",
        privacy: "Privacy",
        accountDeletion: "Delete Account",
      },
    })
  })
})

describe("shouldShowOfficialHostedLegalNotice", () => {
  it("only returns true for explicitly configured hostnames", () => {
    expect(shouldShowOfficialHostedLegalNotice("app.zentrio.eu")).toBe(false)
    expect(shouldShowOfficialHostedLegalNotice("zentrio.eu")).toBe(false)
    expect(shouldShowOfficialHostedLegalNotice("localhost")).toBe(false)
    expect(shouldShowOfficialHostedLegalNotice("demo.zentrio.eu")).toBe(false)
  })
})
