# 🏗️ Architecture Overview

Understanding Zentrio's architecture helps you contribute effectively and customize the application for your needs. This guide covers the system design, patterns, and key components.

## 🎯 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Stremio API   │
│   (React/PWA)   │◄──►│   (Hono/Bun)    │◄──►│   (Streaming)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   SQLite DB     │    │   Content       │
│   Storage       │    │   (Profiles)    │    │   Providers     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

- **Frontend**: React-based PWA with TypeScript
- **Backend**: Hono framework running on Bun
- **Database**: SQLite for profile and settings storage
- **Proxy**: Stremio API proxy for seamless integration
- **Mobile**: Capacitor for native mobile apps

## 📁 Detailed Project Structure

```
app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Button.tsx      # Styled button component
│   │   ├── Input.tsx       # Form input with validation
│   │   ├── Layout.tsx      # Main layout wrapper
│   │   ├── Modal.tsx       # Modal dialog component
│   │   ├── Message.tsx     # Toast/notification system
│   │   ├── ProfileModal.tsx # Profile management modal
│   │   ├── auth/           # Authentication components
│   │   │   ├── MagicLinkModal.tsx
│   │   │   └── OTPModal.tsx
│   │   └── index.ts        # Component exports
│   ├── pages/              # Main application pages
│   │   ├── LandingPage.tsx # Home page with features
│   │   ├── ProfilesPage.tsx # Profile management
│   │   ├── SettingsPage.tsx # Application settings
│   │   └── DownloadsPage.tsx # Download management
│   ├── routes/             # API route handlers
│   │   ├── session.ts      # Session management
│   │   ├── stremio.ts      # Stremio proxy functionality
│   │   ├── views.ts        # View rendering
│   │   └── api/            # REST API endpoints
│   │       ├── auth.ts     # Authentication endpoints
│   │       ├── avatar.ts   # Avatar management
│   │       ├── profiles.ts # Profile CRUD operations
│   │       ├── themes.ts   # Theme management
│   │       ├── user.ts     # User management
│   │       └── index.ts    # API route exports
│   ├── services/           # Business logic layer
│   │   ├── avatar.ts       # Avatar generation/management
│   │   ├── capacitor.ts    # Capacitor platform utilities
│   │   ├── database.ts     # Database operations
│   │   ├── email.ts        # Email sending functionality
│   │   ├── encryption.ts   # Data encryption/decryption
│   │   ├── themeService.ts # Theme management
│   │   └── stremio/        # Stremio-specific services
│   │       ├── proxy.ts    # Stremio proxy logic
│   │       └── scripts/    # Stremio integration scripts
│   ├── middleware/         # Request middleware
│   │   ├── proxy-logger.ts # Request/response logging
│   │   ├── security.ts     # Security headers and validation
│   │   └── session.ts      # Session management middleware
│   ├── static/             # Static assets
│   │   ├── css/            # Stylesheets
│   │   ├── js/             # Client-side JavaScript
│   │   ├── logo/           # Images and icons
│   │   └── media/          # Media files
│   ├── themes/             # Theme configurations
│   │   ├── midnight.json   # Midnight theme
│   │   ├── stremio.json    # Stremio theme
│   │   └── zentrio.json    # Default theme
│   └── index.ts            # Application entry point
├── android/                # Android platform code
├── ios/                    # iOS platform code
├── capacitor.config.ts     # Capacitor configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## 🔄 Data Flow Architecture

### Request Flow

```
User Request → Middleware → Route Handler → Service Layer → Database → Response
     ↓              ↓           ↓              ↓           ↓
  Browser → Security → API Route → Business Logic → SQLite → JSON Response
```

### Authentication Flow

```
1. User enters email
   ↓
2. Request magic link (POST /api/auth/magic-link)
   ↓
3. Generate JWT token and send email
   ↓
4. User clicks email link
   ↓
5. Verify token (GET /api/auth/verify)
   ↓
6. Create session and redirect
   ↓
7. Authenticated requests include JWT header
```

### Profile Management Flow

```
1. List profiles (GET /api/profiles)
   ↓
2. Create profile (POST /api/profiles)
   ↓
3. Store encrypted credentials
   ↓
4. Switch profile (PUT /api/profiles/:id/switch)
   ↓
5. Update session context
   ↓
6. Proxy Stremio requests with profile context
```

## 🎨 Frontend Architecture

### Component Architecture

```
Layout Component
├── Header (Navigation, Profile Switcher)
├── Main Content Area
│   ├── Page Components
│   └── Modal Components
└── Footer
```

### State Management

- **Local State**: React useState for component state
- **Session State**: Server-side session management
- **Persistent State**: SQLite database for profiles/settings
- **Theme State**: Context API for theme management

### Component Patterns

#### Container/Presentational Pattern
```typescript
// Container Component (logic)
const ProfileContainer = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadProfiles();
  }, []);
  
  return <ProfileList profiles={profiles} loading={loading} />;
};

// Presentational Component (UI)
const ProfileList = ({ profiles, loading }) => (
  <div>
    {loading ? <Spinner /> : profiles.map(profile => ...)}
  </div>
);
```

#### Custom Hook Pattern
```typescript
const useProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/profiles');
      setProfiles(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { profiles, loading, loadProfiles };
};
```

## 🔧 Backend Architecture

### Service Layer Pattern

```typescript
// Service Layer (Business Logic)
class ProfileService {
  async createProfile(data: CreateProfileDto): Promise<Profile> {
    // Validation
    this.validateProfileData(data);
    
    // Encryption
    const encryptedCredentials = await this.encryptCredentials(data.credentials);
    
    // Database Operation
    const profile = await this.database.create({
      ...data,
      credentials: encryptedCredentials
    });
    
    // Event Emission
    this.emit('profile:created', profile);
    
    return profile;
  }
}
```

### Repository Pattern

```typescript
// Repository Layer (Data Access)
class ProfileRepository {
  constructor(private db: Database) {}
  
  async findById(id: string): Promise<Profile | null> {
    return this.db.get('SELECT * FROM profiles WHERE id = ?', [id]);
  }
  
  async create(data: CreateProfileData): Promise<Profile> {
    const result = await this.db.run(
      'INSERT INTO profiles (name, stremio_id, credentials) VALUES (?, ?, ?)',
      [data.name, data.stremioId, data.credentials]
    );
    return this.findById(result.lastID);
  }
}
```

### Middleware Chain

```typescript
// Middleware Pipeline
app.use('*', securityMiddleware);      // Security headers
app.use '*', sessionMiddleware);       // Session management
app.use '*', proxyLoggerMiddleware);   // Request logging
app.use '*', rateLimitMiddleware);     // Rate limiting
app.use('*', corsMiddleware);          // CORS handling
```

## 🗄️ Database Architecture

### Schema Design

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  stremio_id TEXT NOT NULL,
  credentials TEXT NOT NULL, -- Encrypted
  avatar_url TEXT,
  settings TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Database Connection Management

```typescript
// Connection Pool (for future scaling)
class DatabaseManager {
  private connections: Database[] = [];
  private readonly maxConnections = 10;
  
  async getConnection(): Promise<Database> {
    if (this.connections.length > 0) {
      return this.connections.pop()!;
    }
    return new Database(this.databaseUrl);
  }
  
  releaseConnection(connection: Database): void {
    if (this.connections.length < this.maxConnections) {
      this.connections.push(connection);
    } else {
      connection.close();
    }
  }
}
```

## 🔐 Security Architecture

### Authentication & Authorization

```typescript
// JWT Token Structure
interface JWTPayload {
  userId: string;
  email: string;
  iat: number;  // Issued at
  exp: number;  // Expires at
}

// Middleware for protected routes
const requireAuth = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }
  
  try {
    const payload = await verifyJWT(token);
    c.set('userId', payload.userId);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};
```

### Data Encryption

```typescript
// Encryption Service
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  
  async encrypt(data: string): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    cipher.setAAD(Buffer.from('zentrio-credentials'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
}
```

## 🌐 API Architecture

### RESTful Design Principles

```typescript
// Resource-based endpoints
GET    /api/profiles        // List all profiles
POST   /api/profiles        // Create new profile
GET    /api/profiles/:id    // Get specific profile
PUT    /api/profiles/:id    // Update profile
DELETE /api/profiles/:id    // Delete profile

// Nested resources
GET    /api/profiles/:id/settings  // Get profile settings
PUT    /api/profiles/:id/settings  // Update profile settings
```

### Response Format Standardization

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    timestamp: string;
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

## 📱 Mobile Architecture

### Capacitor Integration

```
Web App (React) → Capacitor Runtime → Native Container
       ↓                ↓                ↓
   TypeScript      Bridge Layer      Native APIs
   Components      JavaScript       iOS/Android
   Services        → Native         Features
```

### Platform-Specific Code

```typescript
// Platform detection
const isNative = Capacitor.isNativePlatform();
const isIOS = Capacitor.getPlatform() === 'ios';
const isAndroid = Capacitor.getPlatform() === 'android';

// Native feature usage
const saveToPhotos = async (image: string) => {
  if (isNative) {
    await Capacitor.Plugins.Media.savePhoto({ path: image });
  } else {
    // Fallback for web
    downloadImage(image);
  }
};
```

## 🎨 Theme Architecture

### Theme Structure

```typescript
interface Theme {
  name: string;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      base: string;
      lg: string;
      xl: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}
```

### Theme Application

```typescript
// Theme Provider
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  
  useEffect(() => {
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

## 🔧 Development Patterns

### Dependency Injection

```typescript
// Service Container
class ServiceContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory);
  }
  
  get<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not found`);
    }
    return factory();
  }
}

// Usage
container.register('database', () => new Database(process.env.DATABASE_URL));
container.register('profileService', () => new ProfileService(container.get('database')));
```

### Event-Driven Architecture

```typescript
// Event Emitter
class EventEmitter {
  private listeners = new Map<string, Function[]>();
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  emit(event: string, data: any): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }
}

// Usage in services
class ProfileService {
  constructor(private eventEmitter: EventEmitter) {}
  
  async createProfile(data: CreateProfileDto): Promise<Profile> {
    const profile = await this.database.create(data);
    this.eventEmitter.emit('profile:created', profile);
    return profile;
  }
}
```

## 🚀 Performance Architecture

### Caching Strategy

```typescript
// Multi-level caching
class CacheManager {
  private memoryCache = new Map<string, any>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const { data, timestamp } = this.memoryCache.get(key);
      if (Date.now() - timestamp < this.TTL) {
        return data;
      }
    }
    
    // Check database cache
    const cached = await this.database.getCache(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      this.memoryCache.set(key, cached);
      return cached.data;
    }
    
    return null;
  }
}
```

### Database Optimization

```typescript
// Connection pooling and query optimization
class DatabaseService {
  private pool: ConnectionPool;
  
  async getProfiles(userId: string): Promise<Profile[]> {
    // Use prepared statements
    const stmt = this.pool.prepare(`
      SELECT id, name, avatar_url, settings 
      FROM profiles 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    
    return stmt.all(userId);
  }
  
  // Batch operations for better performance
  async updateProfilesBatch(updates: ProfileUpdate[]): Promise<void> {
    const transaction = this.pool.transaction();
    
    try {
      for (const update of updates) {
        transaction.run(`
          UPDATE profiles 
          SET name = ?, settings = ? 
          WHERE id = ?
        `, [update.name, update.settings, update.id]);
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

---

This architecture provides a solid foundation for understanding and contributing to Zentrio. For specific implementation details, check the relevant source code files or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).