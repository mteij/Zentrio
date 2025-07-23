<div align="center">
  
  # 🎬 **Zentrio** 
  
  **A beautiful, secure, Netflix-inspired profile management system for Stremio Web**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Deno](https://img.shields.io/badge/Deno-000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.land/)
  [![Fresh](https://img.shields.io/badge/Fresh-00D2FF?style=for-the-badge&logo=deno&logoColor=white)](https://fresh.deno.dev/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  
  **[🚀 Live Demo](https://zentrio.eu)** • **[🐛 Report Issues](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>

## ✨ **Features**

**🎭 Profile Management** - Netflix-style interface with unlimited profiles, custom avatars, and secure credential storage  
**🔐 Enterprise Security** - AES-256-GCM encryption, session security, rate limiting, and magic link authentication  
**🛡️ Content Filtering** - Smart NSFW detection using TMDB API with per-profile parental controls  
**🎨 Customization** - Custom accent colors, dark theme, responsive design with smooth animations  
**🔧 Advanced Features** - Drag-and-drop addon manager, auto-login options, and real-time sync  
**⚡ Performance** - Edge-ready architecture with islands-based fast loading and offline support

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

## 🛠️ **Tech Stack**

**Frontend:** Fresh (Preact) + TypeScript + Tailwind CSS  
**Backend:** Deno runtime with Fresh framework  
**Database:** MongoDB with Mongoose ODM  
**Security:** AES-256-GCM encryption + session security  
**Deployment:** Docker + health checks

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
  
  **[🚀 Get Started](https://zentrio.deno.dev/)** • **[💬 Join Discussion](https://github.com/MichielEijpe/Zentrio/discussions)** • **[🐛 Report Bug](https://github.com/MichielEijpe/Zentrio/issues)**
  
</div>