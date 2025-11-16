# 👨‍💻 Development Guide

Welcome to the Zentrio development documentation! This guide covers everything you need to know about contributing to, extending, or understanding the Zentrio codebase.

## 🎯 What You'll Learn

This development guide covers:

1. **[Architecture Overview](architecture.md)** - System design and patterns
2. **[Development Setup](setup.md)** - Setting up your development environment
3. **[Contributing Guidelines](contributing.md)** - How to contribute to Zentrio
4. **[Testing Guide](testing.md)** - Writing and running tests
5. **[Debugging Guide](debugging.md)** - Debugging techniques and tools

## 🏗️ Project Architecture

### High-Level Overview

```
Zentrio/
├── app/                    # Main application
│   ├── src/               # Source code
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Request middleware
│   │   ├── static/        # Static assets
│   │   └── themes/        # Theme configurations
│   ├── android/           # Android platform code
│   ├── ios/               # iOS platform code
│   └── capacitor.config.ts # Capacitor configuration
├── docs/                  # Documentation
├── .github/               # GitHub workflows
└── docker-compose.yml     # Docker configuration
```

### Technology Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- **Database**: [SQLite](https://www.sqlite.org/) - Embedded database
- **Mobile**: [Capacitor](https://capacitorjs.com/) - Cross-platform mobile framework
- **Styling**: CSS with custom themes
- **Containerization**: Docker

## 🚀 Quick Start for Developers

### Prerequisites
- **Bun 1.x** (recommended) or Node.js 18+
- **Git**
- **VS Code** (recommended, with extensions below)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Copy environment file
cp .env.example .env

# Navigate to app directory
cd app

# Install dependencies
bun install

# Start development server
bun run dev
```

The development server will start on `http://localhost:3000` with hot reload enabled.

### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "oven.bun-vscode",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json"
  ]
}
```

## 📁 Code Structure Deep Dive

### Core Components

#### `src/components/`
Reusable UI components used across the application:
- **Button.tsx** - Styled button component
- **Input.tsx** - Form input with validation
- **Layout.tsx** - Main layout wrapper
- **Modal.tsx** - Modal dialog component
- **Message.tsx** - Toast/notification system
- **ProfileModal.tsx** - Profile management modal
- **auth/** - Authentication components

#### `src/pages/`
Main application pages:
- **LandingPage.tsx** - Home page with feature overview
- **ProfilesPage.tsx** - Profile management interface
- **SettingsPage.tsx** - Application settings
- **DownloadsPage.tsx** - Download management (upcoming)

#### `src/routes/`
API route handlers:
- **session.ts** - Session management
- **stremio.ts** - Stremio proxy functionality
- **views.ts** - View rendering
- **api/** - REST API endpoints

#### `src/services/`
Business logic and external integrations:
- **avatar.ts** - Avatar generation and management
- **capacitor.ts** - Capacitor platform utilities
- **database.ts** - Database operations
- **email.ts** - Email sending functionality
- **encryption.ts** - Data encryption/decryption
- **themeService.ts** - Theme management
- **stremio/** - Stremio-specific services

## 🔧 Development Workflow

### Available Scripts

```bash
# Development
bun run dev          # Start development server with hot reload
bun run build        # Build for production
bun run start        # Start production server

# Capacitor (Mobile)
bun run cap:sync     # Sync assets to native platforms
bun run cap:open:android  # Open Android Studio
bun run cap:open:ios      # Open Xcode
bun run cap:run:android   # Run on Android
bun run cap:run:ios       # Run on iOS

# Utilities
bun run lint         # Run ESLint
bun run format       # Format code with Prettier
bun run type-check   # TypeScript type checking
```

### Git Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with meaningful commits

3. **Run tests and linting**:
   ```bash
   bun run lint
   bun run type-check
   ```

4. **Push and create a pull request**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Prettier**: Automatic formatting on save
- **ESLint**: Code quality and consistency
- **Conventional Commits**: Use semantic commit messages

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

## 🏗️ Architecture Patterns

### Service Layer Pattern
Business logic is encapsulated in service classes

### Middleware Pattern
Request processing through middleware chain

### Repository Pattern
Database abstraction layer

## 🔌 API Design

### RESTful Endpoints
Consistent REST API design with proper HTTP methods

### Error Handling
Standardized error responses across all endpoints

## 📱 Mobile Development

### Capacitor Integration
Cross-platform mobile apps with native features

### Platform-Specific Code
Handling iOS and Android differences

## 🎨 Theming System

### Theme Structure
JSON-based theme configuration

### Dynamic Theme Loading
Runtime theme switching

## 🔒 Security Considerations

### Authentication Flow
Magic link authentication with JWT tokens

### Data Encryption
Secure credential storage

## 📊 Performance Optimization

### Database Optimization
SQLite optimization techniques

### Frontend Optimization
Lazy loading and code splitting

## 🤖 Contributing for AI Assistants

The codebase is designed to be easily understood and modified by AI assistants:

1. **Clear naming conventions** - Descriptive function and variable names
2. **Comprehensive comments** - Explain complex logic and business rules
3. **Modular architecture** - Small, focused functions and classes
4. **Type safety** - Full TypeScript coverage for better understanding
5. **Consistent patterns** - Predictable code structure throughout

### Key Files for AI Understanding

- **`app/src/index.ts`** - Main application entry point
- **`app/src/routes/index.ts`** - Route definitions
- **`app/src/services/database.ts`** - Database schema and operations
- **`app/capacitor.config.ts`** - Mobile app configuration
- **`docker-compose.yml`** - Deployment configuration

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Hono Framework Guide](https://hono.dev/guides)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing Guidelines

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests if applicable**
5. **Ensure all tests pass**
6. **Submit a pull request**

---

Ready to start contributing? Check out our [Development Setup Guide](setup.md) to configure your environment!