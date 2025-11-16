# 👨‍💻 Development Guide

Welcome to the Zentrio development documentation! This guide covers everything you need to know about contributing to, extending, or understanding the Zentrio codebase.

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

---

## 🚀 Getting Started for Development

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

---

## 📁 Code Structure Deep Dive

### Core Components

#### [`src/components/`](../app/src/components)
Reusable UI components used across the application:

- **Button.tsx** - Styled button component
- **Input.tsx** - Form input with validation
- **Layout.tsx** - Main layout wrapper
- **Modal.tsx** - Modal dialog component
- **Message.tsx** - Toast/notification system
- **ProfileModal.tsx** - Profile management modal
- **auth/** - Authentication components
  - **MagicLinkModal.tsx** - Magic link authentication
  - **OTPModal.tsx** - One-time password input

#### [`src/pages/`](../app/src/pages)
Main application pages:

- **LandingPage.tsx** - Home page with feature overview
- **ProfilesPage.tsx** - Profile management interface
- **SettingsPage.tsx** - Application settings
- **DownloadsPage.tsx** - Download management (upcoming)

#### [`src/routes/`](../app/src/routes)
API route handlers:

- **session.ts** - Session management
- **stremio.ts** - Stremio proxy functionality
- **views.ts** - View rendering
- **api/** - REST API endpoints
  - **auth.ts** - Authentication endpoints
  - **avatar.ts** - Avatar management
  - **profiles.ts** - Profile CRUD operations
  - **themes.ts** - Theme management
  - **user.ts** - User management

#### [`src/services/`](../app/src/services)
Business logic and external integrations:

- **avatar.ts** - Avatar generation and management
- **capacitor.ts** - Capacitor platform utilities
- **database.ts** - Database operations
- **email.ts** - Email sending functionality
- **encryption.ts** - Data encryption/decryption
- **envParser.ts** - Environment variable parsing
- **themeService.ts** - Theme management
- **stremio/** - Stremio-specific services
  - **proxy.ts** - Stremio API proxy
  - **scripts/** - Utility scripts
    - **addonManager.ts** - Addon management
    - **downloadsManager.ts** - Download handling
    - **nsfwFilter.ts** - Content filtering
    - **session.ts** - Session management

### Middleware

#### [`src/middleware/`](../app/src/middleware)
Request processing middleware:

- **proxy-logger.ts** - Request/response logging
- **security.ts** - Security headers and validation
- **session.ts** - Session management

---

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

---

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

### Writing Tests

```typescript
// Example unit test
import { describe, it, expect } from 'bun:test'
import { UserService } from '../src/services/user'

describe('UserService', () => {
  it('should create a new user', async () => {
    const user = await UserService.create({
      email: 'test@example.com',
      password: 'secure-password'
    })
    
    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')
  })
})
```

---

## 🏗️ Architecture Patterns

### Service Layer Pattern

Business logic is encapsulated in service classes:

```typescript
// src/services/profile.ts
export class ProfileService {
  static async create(data: ProfileData): Promise<Profile> {
    // Validation
    const validated = validateProfileData(data)
    
    // Database operation
    const profile = await db.profiles.create(validated)
    
    // Cache update
    await cache.set(`profile:${profile.id}`, profile)
    
    return profile
  }
}
```

### Middleware Pattern

Request processing through middleware chain:

```typescript
// src/middleware/security.ts
export const securityMiddleware = async (c: Context, next: Next) => {
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  
  // Rate limiting
  await rateLimitCheck(c)
  
  await next()
}
```

### Repository Pattern

Database abstraction layer:

```typescript
// src/services/database.ts
export class ProfileRepository {
  static async findById(id: string): Promise<Profile | null> {
    return db.select().from(profiles).where(eq(profiles.id, id)).get()
  }
  
  static async create(data: NewProfile): Promise<Profile> {
    const [profile] = await db.insert(profiles).values(data).returning()
    return profile
  }
}
```

---

## 🔌 API Design

### RESTful Endpoints

```typescript
// GET /api/profiles
export const getProfiles = async (c: Context) => {
  const profiles = await ProfileService.getAll()
  return c.json({ profiles })
}

// POST /api/profiles
export const createProfile = async (c: Context) => {
  const data = await c.req.json()
  const profile = await ProfileService.create(data)
  return c.json({ profile }, 201)
}
```

### Error Handling

```typescript
// src/middleware/error.ts
export const errorHandler = (err: Error, c: Context) => {
  console.error(err)
  
  if (err instanceof ValidationError) {
    return c.json({ error: err.message }, 400)
  }
  
  if (err instanceof AuthenticationError) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  return c.json({ error: 'Internal Server Error' }, 500)
}
```

---

## 📱 Mobile Development

### Capacitor Integration

Zentrio uses Capacitor for cross-platform mobile apps:

```typescript
// src/services/capacitor.ts
export class CapacitorService {
  static isNative(): boolean {
    return Capacitor.isNativePlatform()
  }
  
  static isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android'
  }
  
  static isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios'
  }
}
```

### Platform-Specific Code

```typescript
// Example of platform-specific implementation
if (CapacitorService.isNative()) {
  // Native-specific code
  await StatusBar.setStyle({ style: StatusBarStyle.Dark })
} else {
  // Web-specific code
  document.body.classList.add('web-platform')
}
```

---

## 🎨 Theming System

### Theme Structure

```typescript
// src/themes/zentrio.json
{
  "name": "Zentrio",
  "colors": {
    "primary": "#0366d6",
    "secondary": "#586069",
    "background": "#ffffff",
    "surface": "#f6f8fa"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontSize": {
      "base": "16px",
      "lg": "18px",
      "xl": "20px"
    }
  }
}
```

### Dynamic Theme Loading

```typescript
// src/services/themeService.ts
export class ThemeService {
  static async loadTheme(themeName: string): Promise<void> {
    const theme = await import(`../themes/${themeName}.json`)
    this.applyTheme(theme.default)
  }
  
  static applyTheme(theme: Theme): void {
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })
  }
}
```

---

## 🔒 Security Considerations

### Authentication Flow

1. **Magic Link**: User requests magic link via email
2. **Token Generation**: Server generates signed JWT token
3. **Email Delivery**: Token sent via secure email
4. **Token Validation**: User clicks link, token validated
5. **Session Creation**: Secure session established

### Data Encryption

```typescript
// src/services/encryption.ts
export class EncryptionService {
  static encrypt(data: string, key: string): string {
    const cipher = createCipher('aes-256-cbc', key)
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex')
  }
  
  static decrypt(encryptedData: string, key: string): string {
    const decipher = createDecipher('aes-256-cbc', key)
    return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8')
  }
}
```

### Security Headers

```typescript
// src/middleware/security.ts
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}
```

---

## 📊 Performance Optimization

### Database Optimization

```typescript
// Use prepared statements
const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ?')
const profiles = stmt.all(userId)

// Implement caching
const cacheKey = `profiles:${userId}`
let profiles = await cache.get(cacheKey)

if (!profiles) {
  profiles = await ProfileRepository.findByUserId(userId)
  await cache.set(cacheKey, profiles, { ttl: 300 })
}
```

### Frontend Optimization

```typescript
// Lazy loading components
const LazyProfileModal = lazy(() => import('./components/ProfileModal'))

// Code splitting
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

// Image optimization
const optimizedImage = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer()
```

---

## 🤖 Contributing for AI Assistants

### AI-Friendly Code Structure

The codebase is designed to be easily understood and modified by AI assistants:

1. **Clear naming conventions** - Descriptive function and variable names
2. **Comprehensive comments** - Explain complex logic and business rules
3. **Modular architecture** - Small, focused functions and classes
4. **Type safety** - Full TypeScript coverage for better understanding
5. **Consistent patterns** - Predictable code structure throughout

### Key Files for AI Understanding

- **[`app/src/index.ts`](../app/src/index.ts)** - Main application entry point
- **[`app/src/routes/index.ts`](../app/src/routes/index.ts)** - Route definitions
- **[`app/src/services/database.ts`](../app/src/services/database.ts)** - Database schema and operations
- **[`app/capacitor.config.ts`](../app/capacitor.config.ts)** - Mobile app configuration
- **[`docker-compose.yml`](../docker-compose.yml)** - Deployment configuration

### Common Patterns

```typescript
// Service pattern - business logic
export class ServiceName {
  static async methodName(params: Type): Promise<ReturnType> {
    // 1. Validation
    // 2. Business logic
    // 3. Database operation
    // 4. Return result
  }
}

// Route pattern - API endpoints
export const routeHandler = async (c: Context) => {
  try {
    // 1. Extract request data
    // 2. Call service
    // 3. Return response
  } catch (error) {
    // Handle errors
  }
}

// Component pattern - UI components
export const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // 1. State management
  // 2. Effects
  // 3. Render logic
  return <div>...</div>
}
```

---

## 🐛 Debugging

### Development Debugging

```bash
# Enable debug logs
DEBUG=* bun run dev

# Database debugging
sqlite3 data/zentrio.db ".schema"

# Network debugging
curl -v http://localhost:3000/api/profiles
```

### Production Debugging

```bash
# Docker logs
docker-compose logs -f zentrio

# Process monitoring
pm2 monit

# Performance profiling
bun --prof run src/index.ts
```

---

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Hono Framework Guide](https://hono.dev/guides)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 🤝 Contributing Guidelines

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests if applicable**
5. **Ensure all tests pass**
6. **Submit a pull request**

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

Thank you for contributing to Zentrio! 🎉