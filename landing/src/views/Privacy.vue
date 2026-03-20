<template>
  <LegalPageLayout title="Privacy Policy">
    <div class="legal-section">
      <h2>1. Scope</h2>
      <p>
        This Privacy Policy explains how <strong>{{ legalMeta.operatorName }}</strong>
        handles personal data for the official Zentrio websites, the hosted
        service at <strong>{{ appHost }}</strong>, and the official companion apps
        when used with those official services.
      </p>
      <p>
        If you connect Zentrio to a self-hosted server, the operator of that
        server controls the server-side processing for that instance and is
        responsible for its own privacy disclosures and legal compliance.
      </p>
    </div>

    <div class="legal-section">
      <h2>2. Data We May Collect</h2>
      <p>Depending on how you use the official service, we may process:</p>
      <ul>
        <li>Account information such as email address, username, linked sign-in providers, and authentication state.</li>
        <li>Profile and app data such as profile names, preferences, watch history, library state, settings, and addon configuration.</li>
        <li>Operational data such as session data, device or browser information, abuse-prevention signals, and error logs.</li>
        <li>Support and communication data if you contact us.</li>
        <li>On-device app data such as local caches, downloads, app preferences, and locally stored session tokens.</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2>3. Why We Use Data</h2>
      <p>We use data to operate and secure the official service, including to:</p>
      <ul>
        <li>create and maintain accounts and profiles</li>
        <li>authenticate users and protect sessions</li>
        <li>synchronize settings and playback-related data across official clients</li>
        <li>support native app features and account recovery flows</li>
        <li>detect abuse, debug failures, and improve reliability</li>
        <li>respond to support requests and comply with legal obligations</li>
      </ul>
    </div>

    <div class="legal-section">
      <h2>4. Third-Party Services and Integrations</h2>
      <p>
        Zentrio may interact with third-party providers such as identity
        providers, metadata services, email providers, addon endpoints, and other
        optional integrations you choose to enable.
      </p>
      <p>
        Those third parties operate under their own terms and privacy policies. We
        encourage you to review them before enabling those integrations.
      </p>
    </div>

    <div class="legal-section">
      <h2>5. Data Sharing</h2>
      <p>
        We do not sell personal data. We may share data only where reasonably
        necessary to run the official service, with infrastructure or service
        providers, or when required by law, to protect users, or to enforce our
        rights.
      </p>
    </div>

    <div class="legal-section">
      <h2>6. Retention</h2>
      <p>
        We retain personal data for as long as reasonably necessary to provide the
        official service, maintain security, comply with legal obligations, resolve
        disputes, and enforce agreements.
      </p>
      <p>
        Some data may also remain on your device until you remove the app, clear
        app storage, or delete downloaded files and local caches.
      </p>
    </div>

    <div class="legal-section">
      <h2>7. Account Deletion and Your Choices</h2>
      <p>
        If you created an account for the official hosted service, you can request
        deletion from within the app settings and by using the public instructions
        on our <a :href="legalMeta.accountDeletionUrl">Account Deletion</a> page.
      </p>
      <p>
        If your data is stored on a self-hosted Zentrio server, the operator of
        that server is responsible for fulfilling deletion and access requests for
        that deployment.
      </p>
    </div>

    <div class="legal-section">
      <h2>8. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect the
        official service, but no method of transmission or storage is completely
        secure. You are also responsible for protecting your credentials and any
        self-hosted deployment you operate.
      </p>
    </div>

    <div class="legal-section">
      <h2>9. International and Self-Hosted Use</h2>
      <p>
        Zentrio is open-source and may be deployed by independent operators in
        multiple jurisdictions. This Privacy Policy only covers the official hosted
        Zentrio service. Self-hosted deployments may have different hosting
        locations, integrations, retention periods, and legal obligations.
      </p>
    </div>

    <div class="legal-section">
      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we do, we will
        post the updated version here and revise the effective date shown above.
      </p>
    </div>

    <div class="legal-section">
      <h2>11. Contact</h2>
      <p>
        Privacy-related questions can be sent to
        <a :href="legalMeta.contactEmailHref">{{ legalMeta.contactEmail }}</a>.
      </p>
    </div>
  </LegalPageLayout>
</template>

<script setup>
import LegalPageLayout from "../components/LegalPageLayout.vue";
import { legalMeta } from "../legal";

const appHost = new URL(legalMeta.webAppUrl).host;
</script>
