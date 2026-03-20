<template>
  <LegalPageLayout title="Account Deletion">
    <div class="legal-section">
      <h2>1. Scope</h2>
      <p>
        These instructions apply to accounts created for the official hosted
        Zentrio service. If you use a self-hosted Zentrio server, contact that
        server's operator for deletion requests relating to that deployment.
      </p>
    </div>

    <div class="legal-section">
      <h2>2. Delete Your Official Hosted-Service Account In App</h2>
      <p>
        In the Zentrio app, sign in to your account, open Settings, go to the
        Danger Zone, and choose <strong>Delete Account</strong>. The app will ask
        for confirmation before permanently deleting the account.
      </p>
    </div>

    <div class="legal-section">
      <h2>3. Delete Your Official Hosted-Service Account Outside the App</h2>
      <p>
        If you cannot access the app, email
        <a :href="legalMeta.contactEmailHref">{{ legalMeta.contactEmail }}</a>
        and include:
      </p>
      <ul>
        <li>the email address associated with the official hosted-service account</li>
        <li>that you are requesting account deletion for the hosted Zentrio service</li>
        <li>enough information for us to verify the request safely, if needed</li>
      </ul>
      <p>
        We may need to confirm account ownership before completing the request.
      </p>
      <p>
        For general support that is not an account-deletion request, you can still
        use our <a :href="legalMeta.supportUrl">public issue tracker</a>.
      </p>
    </div>

    <div class="legal-section">
      <h2>4. What Deletion Covers</h2>
      <p>
        Deleting an official hosted-service account is intended to remove the
        account and associated hosted-service data that we control, subject to
        limited retention where reasonably necessary for security, fraud
        prevention, legal compliance, dispute handling, or enforcement.
      </p>
      <p>
        Deletion does not automatically remove data stored on self-hosted Zentrio
        servers, third-party services, backups retained for legitimate operational
        reasons, or content and logs controlled by independent operators.
      </p>
    </div>

    <div class="legal-section">
      <h2>5. Local Device Data</h2>
      <p>
        Account deletion does not automatically erase local files stored on your
        own device, such as downloads, caches, app storage, or screenshots. You
        may need to remove those manually or uninstall the app.
      </p>
    </div>
  </LegalPageLayout>
</template>

<script setup>
import LegalPageLayout from "../components/LegalPageLayout.vue";
import { legalMeta } from "../legal";
</script>
