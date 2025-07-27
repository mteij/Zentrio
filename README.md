<div align="center">
  
  # 💠 **Zentrio** 
  
  **A beautiful, secure, Netflix-inspired profile management system for Stremio Web**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Deno](https://img.shields.io/badge/Deno-000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.land/)
  [![Fresh](https://img.shields.io/badge/Fresh-00D2FF?style=for-the-badge&logo=deno&logoColor=white)](https://fresh.deno.dev/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  
  **[🚀 Public Instance](https://zentrio.eu)** • **[🐛 Report Issues](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>

---

## 🛡️ **Belangrijke opmerking & Disclaimer**

Welkom bij Zentrio! Voordat je verdergaat, neem even de tijd om dit door te lezen.

**Over de ontwikkeling:** Dit project is grotendeels ontwikkeld met behulp van AI-assistenten zoals GitHub Copilot en Claude. Hoewel ik de code zorgvuldig controleer en test, is het belangrijk te weten dat een aanzienlijk deel van de codebase door AI is gegenereerd of verbeterd.

**Jouw veiligheid:**
*   **Gebruik unieke wachtwoorden:** Gebruik voor je eigen veiligheid een uniek wachtwoord voor Zentrio dat je nergens anders gebruikt.
*   **Nieuwe Stremio-profielen:** Het wordt sterk aangeraden om nieuwe, lege Stremio-profielen aan te maken wanneer je deze dienst gebruikt, in plaats van je bestaande profielen te koppelen.

**Juridische disclaimer:** Dit is een persoonlijk project en is niet gelieerd aan, onderschreven door of gesponsord door Stremio. Ik erken dat deze dienst de grenzen van de servicevoorwaarden van Stremio kan opzoeken en zal voldoen aan alle verzoeken tot verwijdering of stopzetting van Stremio of hun wettelijke vertegenwoordigers. De officiële Stremio-website vind je op [stremio.com](https://stremio.com).

---

## ✨ **Features**

- **Profile Management**: Unlimited profiles with custom avatars.
- **Content Filtering**: Per-profile NSFW filtering.
- **Addon Management**: Reorder and sync addons.
- **PWA Support**: Installable as a web app.

---

## 🚀 **Quick Start**

```bash
# Clone and setup
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio
cp .env.example .env

# Edit .env with your credentials (see below)

# Start development server
cd app && deno task start
```

**Environment Variables (`.env`):**
```env
MONGO_URI="your_mongodb_connection_string"
RESEND_API_KEY="your_resend_api_key" 
EMAIL_FROM_DOMAIN="noreply@yourdomain.com"
ENCRYPTION_MASTER_KEY="generated_64_char_hex_key"
```

Generate the encryption key with: `python3 -c "import uuid; print((uuid.uuid4().hex + uuid.uuid4().hex))"`

---

## 🐳 **Docker Deployment**

**Quick Setup:**
```bash
# With included MongoDB
docker-compose up -d

# Or standalone container
docker run -d -p 8000:8000 --env-file .env ghcr.io/michieleijpe/zentrio:latest
```

Includes health checks, MongoDB service, and production-ready configuration.

### **Install**
Visit **[zentrio.eu](https://zentrio.eu)** and use your browser's "Add to Home Screen" or install button to install the Webapp.

---

## 📊 **Project Stats**

<div align="center">
  
  ![GitHub stars](https://img.shields.io/github/stars/MichielEijpe/Zentrio?style=social)
  ![GitHub forks](https://img.shields.io/github/forks/MichielEijpe/Zentrio?style=social)
  ![GitHub issues](https://img.shields.io/github/issues/MichielEijpe/Zentrio)
  ![GitHub license](https://img.shields.io/github/license/MichielEijpe/Zentrio)
  
</div>

---

## 🌐 **Public Instance**

You can try Zentrio without setting up anything at **[zentrio.eu](https://zentrio.eu)** - our free public instance that's always up-to-date with the latest features.

---

## 💖 **Acknowledgments**

Special thanks to:

- **[pancake3000](https://github.com/pancake3000/stremio-addon-manager)** - Original addon manager concept
- **[Stremio Team](https://www.stremio.com/)** - Amazing streaming platform
- **[Deno Team](https://deno.land/)** - Revolutionary JavaScript runtime
- **Our Contributors** - Making Zentrio better every day

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  
  **Made with ❤️ for the Stremio Community**
  
  ⭐ **Star this repo if you found it helpful!** ⭐
  
  ---
  
  **[🚀 Hosted Version](https:/zentrio.eu)** • **[💬 Join Discussion](https://github.com/MichielEijpe/Zentrio/discussions)** • **[🐛 Report Bug](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>
