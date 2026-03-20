<template>
  <LegalPageLayout title="Terms of Service">
    <div class="legal-section">
      <h2>1. Who These Terms Apply To</h2>
      <p>
        These Terms of Service apply to the official Zentrio websites operated by
        <strong>{{ legalMeta.operatorName }}</strong>, including
        <strong>{{ websiteHost }}</strong>, the hosted application at
        <strong>{{ appHost }}</strong>, and the official companion apps when they
        are used with those official services.
      </p>
      <p>
        They do not automatically apply to self-hosted Zentrio deployments run by
        you or by another third party. Operators of self-hosted instances are
        responsible for publishing and enforcing their own terms.
      </p>
    </div>

    <div class="legal-section">
      <h2>2. Description of the Hosted Service</h2>
      <p>
        Zentrio is software for organizing media libraries, profiles, playback
        state, metadata, and related integrations across devices. The official
        hosted service may provide account management, synchronization, profile
        configuration, authentication, and access to app features that depend on
        the official infrastructure.
      </p>
      <p>
        Zentrio is also distributed as self-hostable software. Availability,
        performance, and features may differ between the official hosted service
        and self-hosted deployments.
      </p>
    </div>

    <div class="legal-section">
      <h2>3. Accounts and Access</h2>
      <p>
        You may need an account to use parts of the hosted service. You are
        responsible for maintaining the security of your account credentials and
        for activity that occurs through your account.
      </p>
      <p>
        You must provide accurate information when creating an account and keep it
        reasonably up to date. We may suspend or restrict access if we reasonably
        believe an account is being used unlawfully, fraudulently, abusively, or
        in a way that threatens the security or reliability of the service.
      </p>
    </div>

    <div class="legal-section">
      <h2>4. Acceptable Use</h2>
      <p>
        You may not use the hosted service to violate applicable law, infringe the
        rights of others, interfere with the service, bypass technical
        restrictions, or distribute malware or abusive traffic.
      </p>
      <ul>
        <li>Do not use the service for unlawful, infringing, or fraudulent activity.</li>
        <li>Do not attempt to reverse engineer, disrupt, overload, or probe the hosted infrastructure in a harmful way.</li>
        <li>Do not use shared or third-party addons, integrations, or content sources in a way that violates the rights of others or the rules that govern those services.</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2>5. Third-Party Services, Addons, and Content Sources</h2>
      <p>
        Zentrio can interoperate with third-party identity providers, metadata
        providers, addons, integrations, and externally operated content sources.
        Those services are independent from the official Zentrio hosted service.
      </p>
      <p>
        We do not control and are not responsible for the availability, legality,
        accuracy, security, or policies of third-party services or community-made
        addons. Your use of them is at your own risk and may be subject to
        separate terms and privacy policies.
      </p>
    </div>

    <div class="legal-section">
      <h2>6. Intellectual Property and Open Source</h2>
      <p>
        The Zentrio source code is made available under the open-source license
        published in the repository. Those license terms govern your use of the
        codebase itself.
      </p>
      <p>
        These hosted-service Terms govern the official service experience, not the
        underlying open-source license. Branding, hosted infrastructure, site
        content, and service operations may be subject to additional rights
        reserved by their respective owners.
      </p>
    </div>

    <div class="legal-section">
      <h2>7. Privacy</h2>
      <p>
        Our handling of personal data for the official hosted service is described
        in the
        <a :href="legalMeta.privacyUrl">Privacy Policy</a>. If you use a
        self-hosted Zentrio server, the operator of that server is responsible for
        its privacy practices.
      </p>
    </div>

    <div class="legal-section">
      <h2>8. Suspension, Termination, and Availability</h2>
      <p>
        We may suspend, restrict, or terminate access to the hosted service if
        necessary to protect users, comply with law, address abuse, or maintain
        the security and integrity of the service.
      </p>
      <p>
        We do not guarantee uninterrupted availability of the hosted service or of
        any third-party integration. Features may change, be discontinued, or be
        unavailable in some regions, environments, or deployments.
      </p>
    </div>

    <div class="legal-section">
      <h2>9. Disclaimers and Limitation of Liability</h2>
      <p>
        The hosted service is provided on an "as is" and "as available" basis to
        the maximum extent permitted by applicable law. We disclaim warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>
      <p>
        To the maximum extent permitted by law, the Zentrio project maintainers
        and contributors are not liable for indirect, incidental, consequential,
        special, exemplary, or punitive damages, or for loss of data, profits,
        goodwill, or business interruption arising from or related to the hosted
        service.
      </p>
    </div>

    <div class="legal-section">
      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will publish
        the revised version on this page and update the effective date above.
        Continued use of the hosted service after an update becomes effective means
        you accept the revised Terms.
      </p>
    </div>

    <div class="legal-section">
      <h2>11. Contact</h2>
      <p>
        Questions about these Terms can be sent to
        <a :href="legalMeta.contactEmailHref">{{ legalMeta.contactEmail }}</a>.
      </p>
    </div>
  </LegalPageLayout>
</template>

<script setup>
import LegalPageLayout from "../components/LegalPageLayout.vue";
import { legalMeta } from "../legal";

const websiteHost = new URL(legalMeta.websiteUrl).host;
const appHost = new URL(legalMeta.webAppUrl).host;
</script>
