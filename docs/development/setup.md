# 🛠️ Development Setup Guide

Set up your development environment to contribute to Zentrio or customize it for your needs. This guide covers everything you need to get started.

## 🎯 Prerequisites

### Required Software

- **Bun 1.x** (recommended) or Node.js 18+
- **Git** for version control
- **VS Code** (recommended) with extensions below
- **Docker** (optional, for containerized development)

### Platform Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **RAM**: 4GB+ recommended
- **Storage**: 2GB free space
- **Network**: Internet connection for dependencies

## 🚀 Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio
```

### 2. Install Dependencies

```bash
# Using Bun (recommended)
cd app
bun install

# Or using npm
cd app
npm install
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
# Minimum required for development:
AUTH_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-change-in-production
NODE_ENV=development
```

### 4. Start Development Server

```bash
# Using Bun
bun run dev

# Or using npm
npm run dev
```

The development server starts at `http://localhost:3000` with hot reload enabled.

## 📁 Project Structure

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
│   ├── capacitor.config.ts # Capacitor configuration
│   ├── package.json       # Dependencies and scripts
│   └── tsconfig.json      # TypeScript configuration
├── docs/                  # Documentation
├── .github/               # GitHub workflows
├── docker-compose.yml     # Docker configuration
└── README.md             # Project information
```

## 🔧 Development Tools

### VS Code Setup

Install these recommended extensions:

```json
{
  "recommendations": [
    "oven.bun-vscode",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-css",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Git Hooks (Optional)

Set up pre-commit hooks for code quality:

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

## 🧪 Available Scripts

### Development Scripts

```bash
# Start development server with hot reload
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Code Quality Scripts

```bash
# Run ESLint
bun run lint

# Fix linting issues
bun run lint:fix

# Format code with Prettier
bun run format

# TypeScript type checking
bun run type-check

# Run all quality checks
bun run check
```

### Mobile Development Scripts

```bash
# Sync assets to native platforms
bun run cap:sync

# Open Android Studio
bun run cap:open:android

# Open Xcode
bun run cap:open:ios

# Run on Android device/emulator
bun run cap:run:android

# Run on iOS device/simulator
bun run cap:run:ios

# Build mobile apps
bun run cap:build:android
bun run cap:build:ios
```

## 🏗️ Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Follow the existing code style
- Add comments for complex logic
- Update tests if applicable
- Commit frequently with meaningful messages

### 3. Test Your Changes

```bash
# Run linting and type checking
bun run lint
bun run type-check

# Run tests
bun test

# Test manually in browser
bun run dev
```

### 4. Submit Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- Clear description of changes
- Related issues (if any)
- Testing instructions
- Screenshots (if UI changes)

## 📱 Mobile Development Setup

### Prerequisites for Mobile

#### iOS Development
- **macOS** (required)
- **Xcode 14+** from Mac App Store
- **Apple Developer Account** ($99/year for distribution)
- **iOS Device** or Simulator

#### Android Development
- **Android Studio** from developer.android.com
- **Android SDK** (API 33+ recommended)
- **Java JDK 17+**
- **Android Device** or Emulator

### Mobile Development Workflow

```bash
# After making web changes
bun run build

# Sync to mobile platforms
bun run cap:sync

# Run on device
bun run cap:run:android  # or cap:run:ios
```

### Platform-Specific Tips

#### iOS
- Use iOS Simulator for quick testing
- Test on real device before release
- Configure signing in Xcode

#### Android
- Use Android Emulator for development
- Test on multiple screen sizes
- Configure build variants in Android Studio

## 🐛 Debugging

### Backend Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug bun run dev

# Use Node.js debugger
node --inspect-brk node_modules/.bin/bun run dev
```

### Frontend Debugging

- Use browser DevTools (F12)
- Check Console for errors
- Use Network tab for API calls
- Debug React components with React DevTools

### Mobile Debugging

#### iOS
- Use Safari Web Inspector
- Connect device to Mac
- Safari → Develop → [Device] → [App]

#### Android
- Use Chrome DevTools
- Enable USB debugging
- `chrome://inspect` in Chrome

## 🔄 Hot Reload & Live Reload

### Web Development

Hot reload is enabled by default:
- Changes to TypeScript/JSX files reload automatically
- CSS changes apply without full reload
- State is preserved during reload

### Mobile Development

```bash
# Enable live reload for mobile
bun run cap:sync
bun run cap:run:android --livereload --external
```

## 📊 Performance Monitoring

### Development Tools

```bash
# Bundle analyzer
bun run build:analyze

# Performance profiling
bun run dev --profile

# Memory usage
node --inspect node_modules/.bin/bun run dev
```

### Browser DevTools

- **Performance Tab**: Record and analyze runtime performance
- **Memory Tab**: Check for memory leaks
- **Network Tab**: Analyze API calls and loading times
- **Coverage Tab**: Find unused CSS/JS

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/components/Button.test.ts

# Run tests matching pattern
bun test --test-name-pattern "Button"
```

### Integration Tests

```bash
# Run integration tests
bun test test/integration/

# Run with database
DATABASE_URL=":memory:" bun test test/integration/
```

### E2E Tests

```bash
# Run E2E tests
bun test test/e2e/

# Run with specific browser
bun test test/e2e/ --browser=chrome
```

### Test Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for components
├── e2e/           # End-to-end tests for user flows
└── fixtures/      # Test data and mocks
```

## 🔧 Environment Configuration

### Development Environment

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
PROXY_LOGS=true
STREMIO_LOGS=true
DATABASE_URL=./data/zentrio-dev.db
```

### Test Environment

```bash
# .env.test
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=:memory:
AUTH_SECRET=test-secret
ENCRYPTION_KEY=test-key
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
PROXY_LOGS=false
STREMIO_LOGS=false
```

## 🚀 Common Development Tasks

### Adding a New Component

1. Create component file: `src/components/NewComponent.tsx`
2. Add tests: `tests/unit/NewComponent.test.tsx`
3. Export from `src/components/index.ts`
4. Use in your pages

### Adding a New API Route

1. Create route file: `src/routes/api/new-endpoint.ts`
2. Add tests: `tests/integration/new-endpoint.test.ts`
3. Update API documentation
4. Test with curl or Postman

### Adding a New Page

1. Create page file: `src/pages/NewPage.tsx`
2. Add route in `src/routes/index.ts`
3. Add navigation link
4. Test responsive design

### Updating Themes

1. Modify theme files in `src/themes/`
2. Test with different themes
3. Update theme documentation
4. Add theme tests if needed

## 🆘 Getting Help

### Common Issues

- **Port 3000 in use**: Kill process or use different port
- **Dependencies fail**: Clear cache and reinstall
- **Build fails**: Check TypeScript errors
- **Mobile sync fails**: Build web app first

### Resources

- **Documentation**: [Full docs](../../)
- **API Reference**: [API docs](../api/)
- **GitHub Issues**: [Report issues](https://github.com/MichielEijpe/Zentrio/issues)
- **Discussions**: [Ask questions](https://github.com/MichielEijpe/Zentrio/discussions)

---

Ready to contribute? Check our [contributing guidelines](contributing.md) and start making a difference!