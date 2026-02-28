<template>
  <div class="tos-view">
    <div class="container">
      <header class="page-header">
        <h1 class="page-title">Terms of Service</h1>
        <p class="page-subtitle">
          Effective as of {{ currentDate }}.
        </p>
      </header>

      <section class="tos-content">
        <div class="tos-section">
          <h2>1. Basic Concepts</h2>
          <p>
            Welcome to Zentrio. These General Terms and Conditions cover the Zentrio owned and operated websites, including <strong>zentrio.eu</strong>, our web application at <strong>app.zentrio.eu</strong>, our native applications, and any services offered by Zentrio (collectively, the “Services”).
          </p>
          <p>
            By accessing or using our Services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Services.
          </p>
        </div>

        <div class="tos-section">
          <h2>2. Description of Service</h2>
          <p>
            Zentrio is a modern, self-hosted streaming platform. It allows users to manage multiple profiles, sync states across devices, and seamlessly install Stremio-compatible addons for accessing content. Zentrio acts as a metadata catalogue and platform; we do not host, provide, or upload any streamable content ourselves unless explicitly stated.
          </p>
          <p>
            The addons used within Zentrio are developed either by the core team or by independent third-party developers (Community Addons). We are not responsible for the content provided by third-party addons.
          </p>
        </div>

        <div class="tos-section">
          <h2>3. Open Source & Licensing</h2>
          <p>
            Zentrio is open-source software. Our source code is publicly available on GitHub. You are free to view, modify, and contribute to the project in accordance with our open-source license.
          </p>
          <p>
            However, the Zentrio brand, logos, and specific website designs remain the intellectual property of the Zentrio team. 
          </p>
        </div>

        <div class="tos-section">
          <h2>4. User Responsibilities</h2>
          <p>
            As a user of Zentrio, you are responsible for:
            <ul>
              <li>Ensuring that your use of the Services, including any third-party addons you install, complies with the laws and regulations of your country of residence.</li>
              <li>Maintaining the security and confidentiality of your Zentrio profiles and server instances (if self-hosting).</li>
              <li>Not using the Services for any unlawful, infringing, or fraudulent activities.</li>
            </ul>
          </p>
        </div>

        <div class="tos-section">
          <h2>5. Privacy and Security</h2>
          <p>
            We take privacy and security seriously. For users on our public instances, we only store the minimum necessary data to provide functionality like profile synchronization and watch history. We do not sell your data.
          </p>
          <p>
            Since Zentrio can be self-hosted, you have complete ownership and control over your data if you choose to host your own instance of the backend. 
          </p>
        </div>

        <div class="tos-section">
          <h2>6. Limitation of Liability</h2>
          <p>
            The Services are provided "as is" and "as available". Zentrio disclaims any warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            In no event shall Zentrio, its developers, or contributors be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use of or inability to use the Services.
          </p>
        </div>

        <div class="tos-section">
          <h2>7. Changes to the Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Any changes will be effective immediately upon posting on this page. Your continued use of the Services after changes are posted constitutes your acceptance of the new Terms.
          </p>
        </div>
        
        <div class="tos-section">
          <h2>8. Contact</h2>
          <p>
            If you have any questions or concerns about these Terms, you can reach out to us via our GitHub repository or community channels.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const currentDate = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    dateStyle: 'long'
  });
});
</script>

<style scoped>
.tos-view {
  padding-top: 120px;
  padding-bottom: 80px;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 60px;
}

.page-title {
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -0.03em;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 1.2rem;
}

.tos-content {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
}

.tos-section {
  margin-bottom: 40px;
}

.tos-section:last-child {
  margin-bottom: 0;
}

.tos-section h2 {
  font-size: 1.8rem;
  margin-bottom: 16px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.tos-section p {
  color: var(--text-muted);
  margin-bottom: 16px;
  font-size: 1.05rem;
  line-height: 1.7;
}

.tos-section p:last-child {
  margin-bottom: 0;
}

.tos-section ul {
  padding-left: 24px;
  margin-top: 12px;
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.tos-section li {
  margin-bottom: 8px;
}

.tos-section strong {
  color: var(--text);
}

@media (max-width: 768px) {
  .page-title {
    font-size: 2.8rem;
  }

  .tos-content {
    padding: 24px;
  }

  .tos-section h2 {
    font-size: 1.5rem;
  }
}
</style>
