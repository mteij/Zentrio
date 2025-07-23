<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="80" height="80" alt="TypeScript"/>
  
  # 🎬 **Zentrio** 
  
  ### *The Ultimate Stremio Web Experience*
  
  **A beautiful, secure, Netflix-inspired profile management system for Stremio Web**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Deno](https://img.shields.io/badge/Deno-000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.land/)
  [![Fresh](https://img.shields.io/badge/Fresh-00D2FF?style=for-the-badge&logo=deno&logoColor=white)](https://fresh.deno.dev/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  
  ---
  
  **[🚀 Live Demo](https://zentrio.deno.dev/)** • **[📚 Documentation](https://github.com/MichielEijpe/Zentrio/wiki)** • **[🐛 Report Issues](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>

---

## ✨ **What is Zentrio?**

Zentrio transforms your Stremio Web experience with a gorgeous, Netflix-inspired interface that brings modern profile management, enhanced security, and powerful customization features to your favorite streaming platform.

<div align="center">
  <img src="https://via.placeholder.com/800x400/1f2937/ffffff?text=Beautiful+Netflix-Style+Interface" alt="Zentrio Interface" style="border-radius: 10px; margin: 20px 0;"/>
</div>

---

## 🌟 **Cool Features**

### 🎭 **Profile Management**
- **Netflix-Style Interface** - Familiar, intuitive profile selection with beautiful animations
- **Multiple Profiles** - Create unlimited profiles for different family members or viewing preferences
- **Custom Avatars** - Personalized profile pictures with randomization and initials generation
- **Secure Profiles** - Each profile maintains separate Stremio credentials with enterprise-grade encryption

### 🔐 **Enterprise Security**
- **Military-Grade Encryption** - AES-256-GCM encryption for all sensitive data
- **Zero-Trust Architecture** - Passwords and API keys encrypted at rest with unique salts
- **Magic Link Authentication** - Passwordless login via secure email links
- **Automatic Migration** - Seamless upgrade from legacy unencrypted data

### 🛡️ **Content Filtering**
- **NSFW Content Filter** - Intelligent adult content detection using TMDB API
- **Per-Profile Settings** - Individual NSFW filtering for each family member
- **Smart Detection** - Advanced algorithms identify inappropriate content accurately
- **Parental Controls** - Safe viewing environment for all ages

### 🎨 **Customization**
- **Custom Accent Colors** - Personalize your interface with 9 beautiful preset colors
- **Dark Theme** - Sleek, modern dark interface that's easy on the eyes
- **Responsive Design** - Perfect experience on desktop, tablet, and mobile devices
- **Smooth Animations** - Fluid transitions and micro-interactions

### 🔧 **Advanced Features**
- **Stremio Addon Manager** - Drag-and-drop addon reordering with integrated popup interface
- **Auto-Login Options** - Smart login to last used profile or specific profile
- **Real-Time Sync** - Instant updates across all your devices
- **Export Functionality** - Backup and restore your profile configurations

### ⚡ **Performance & Reliability**
- **Edge-Ready Architecture** - Deploy globally with Deno Deploy
- **Islands Architecture** - Fast loading with minimal JavaScript
- **Offline Support** - Cached data for uninterrupted experience
- **Auto-Refresh** - Seamless updates after configuration changes

### 🌐 **Developer Experience**
- **Modern Tech Stack** - Built with Deno, Fresh, TypeScript, and Tailwind CSS
- **Clean Architecture** - Modular codebase with shared components and utilities
- **Type Safety** - Full TypeScript coverage for reliable development
- **Docker Support** - Easy deployment with containerization

---

## 🚀 **Quick Start**

### Prerequisites
- [Deno](https://deno.land/) v1.30.0+
- MongoDB database
- [Resend](https://resend.com/) API key for email authentication

### Installation

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI, Resend API key, and encryption master key

# Start the development server
cd app
deno task start
```

🎉 **That's it!** Visit [http://localhost:8000](http://localhost:8000) to see Zentrio in action.

---

## 🔧 **Environment Setup**

Create a `.env` file in the project root:

```env
# Database
MONGO_URI="your_mongodb_connection_string"

# Email Authentication
RESEND_API_KEY="your_resend_api_key"

# Security (Generate with: deno run -A generate-key.js)
ENCRYPTION_MASTER_KEY="your_64_character_hex_master_key"
```

> 🔒 **Security Note:** The encryption master key is critical for data security. Generate a secure key using the built-in utility and store it safely.

---

## 🐳 **Docker Deployment**

### Using Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'
services:
  zentrio:
    image: ghcr.io/michieleijpe/zentrio:latest
    container_name: zentrio
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
docker-compose up -d
```

### Using Docker Run

```bash
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  --name zentrio \
  --restart unless-stopped \
  ghcr.io/michieleijpe/zentrio:latest
```

---

## 📱 **Screenshots**

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="https://via.placeholder.com/350x200/1f2937/ffffff?text=Profile+Selection" alt="Profile Selection" style="border-radius: 8px;"/>
        <br><strong>Profile Selection</strong>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/350x200/1f2937/ffffff?text=Settings+Panel" alt="Settings Panel" style="border-radius: 8px;"/>
        <br><strong>Settings Panel</strong>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="https://via.placeholder.com/350x200/1f2937/ffffff?text=Addon+Manager" alt="Addon Manager" style="border-radius: 8px;"/>
        <br><strong>Addon Manager</strong>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/350x200/1f2937/ffffff?text=Stremio+Interface" alt="Stremio Interface" style="border-radius: 8px;"/>
        <br><strong>Enhanced Stremio</strong>
      </td>
    </tr>
  </table>
</div>

---

## 🛠️ **Tech Stack**

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="https://deno.land/logo.svg" width="40"/><br><strong>Deno</strong><br><em>Runtime</em></td>
      <td align="center"><img src="https://fresh.deno.dev/logo.svg" width="40"/><br><strong>Fresh</strong><br><em>Framework</em></td>
      <td align="center"><img src="https://preactjs.com/assets/app-icon.png" width="40"/><br><strong>Preact</strong><br><em>UI Library</em></td>
      <td align="center"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="40"/><br><strong>TypeScript</strong><br><em>Language</em></td>
    </tr>
    <tr>
      <td align="center"><img src="https://tailwindcss.com/_next/static/media/tailwindcss-mark.3c5441fc7a190fb1800d4a5c7f07ba4b1345a9c8.svg" width="40"/><br><strong>Tailwind</strong><br><em>CSS</em></td>
      <td align="center"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" width="40"/><br><strong>MongoDB</strong><br><em>Database</em></td>
      <td align="center"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" width="40"/><br><strong>Docker</strong><br><em>Container</em></td>
      <td align="center">🔐<br><strong>Encryption</strong><br><em>AES-256-GCM</em></td>
    </tr>
  </table>
</div>

---

## 📖 **Documentation**

- **[Security Setup Guide](./SECURITY_SETUP.md)** - Complete security configuration
- **[API Documentation](./docs/api.md)** - REST API reference
- **[Development Guide](./docs/development.md)** - Contributing guidelines
- **[Deployment Guide](./docs/deployment.md)** - Production deployment

---

## 🤝 **Contributing**

We love contributions! Whether it's:

- 🐛 **Bug Reports** - Found an issue? Let us know!
- 💡 **Feature Requests** - Have an idea? We'd love to hear it!
- 🔧 **Code Contributions** - Pull requests are always welcome!
- 📖 **Documentation** - Help make our docs even better!

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

---

## 📊 **Project Stats**

<div align="center">
  
  ![GitHub stars](https://img.shields.io/github/stars/MichielEijpe/Zentrio?style=social)
  ![GitHub forks](https://img.shields.io/github/forks/MichielEijpe/Zentrio?style=social)
  ![GitHub issues](https://img.shields.io/github/issues/MichielEijpe/Zentrio)
  ![GitHub license](https://img.shields.io/github/license/MichielEijpe/Zentrio)
  
</div>

---

## 🎯 **Roadmap**

- [ ] **Mobile App** - Native iOS/Android applications
- [ ] **Themes System** - Custom theme creation and sharing
- [ ] **Plugin Architecture** - Third-party plugin support
- [ ] **Advanced Analytics** - Viewing statistics and recommendations
- [ ] **Social Features** - Profile sharing and recommendations
- [ ] **Backup & Sync** - Cloud backup and multi-device sync

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
  
  **[🚀 Get Started](https://zentrio.deno.dev/)** • **[💬 Join Discussion](https://github.com/MichielEijpe/Zentrio/discussions)** • **[🐛 Report Bug](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>