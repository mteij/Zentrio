# 📚 API Reference

Welcome to the Zentrio API documentation! This comprehensive reference covers all endpoints, authentication methods, and integration examples for working with the Zentrio API.

## 🎯 What You'll Learn

This API reference covers:

1. **[Authentication](authentication.md)** - Authentication flow and methods
2. **[API Endpoints](endpoints.md)** - Complete endpoint documentation
3. **[Code Examples](examples.md)** - Integration examples in multiple languages

## 🔐 Authentication Overview

Zentrio uses JWT-based authentication with magic link email authentication:

1. **Request Magic Link**: Send email to receive authentication link
2. **Verify Token**: Exchange magic link token for JWT
3. **Use JWT**: Include token in subsequent requests

### Quick Authentication Example

```bash
# 1. Request magic link
curl -X POST https://yourdomain.com/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Verify token (from email link)
curl https://yourdomain.com/api/auth/verify?token=jwt_token_here

# 3. Use JWT in API calls
curl https://yourdomain.com/api/profiles \
  -H "Authorization: Bearer your_jwt_token"
```

## 📋 Available Endpoints

### Authentication
- `POST /api/auth/magic-link` - Request magic link
- `GET /api/auth/verify` - Verify magic link token
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/user` - Get current user
- `PUT /api/user` - Update user
- `DELETE /api/user` - Delete user

### Profile Management
- `GET /api/profiles` - Get all profiles
- `POST /api/profiles` - Create profile
- `GET /api/profiles/:id` - Get specific profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile

### Avatar Management
- `POST /api/avatar` - Upload avatar
- `GET /api/avatar/:profileId` - Get avatar
- `DELETE /api/avatar/:profileId` - Delete avatar

### Theme Management
- `GET /api/themes` - Get available themes
- `GET /api/themes/:name` - Get specific theme

### System
- `GET /health` - Health check
- `GET /api/system/info` - System information

## 🌐 Base URL

- **Production**: `https://yourdomain.com`
- **Development**: `http://localhost:3000`
- **Public Instance**: `https://zentrio.eu`

## 📝 Request/Response Format

### Request Headers

```http
Content-Type: application/json
Authorization: Bearer jwt_token_here
```

### Response Format

All API responses follow a consistent format:

#### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

#### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## 🚨 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## 🔄 Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **Upload endpoints**: 10 requests per hour per user

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 🌐 CORS

The API supports Cross-Origin Resource Sharing with configurable origins:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
```

## 📚 SDK Examples

### JavaScript/TypeScript

```typescript
class ZentrioAPI {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async authenticate(email: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) throw new Error('Authentication failed');
  }

  async verifyToken(token: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/verify?token=${token}`);
    const data = await response.json();
    
    if (data.success) {
      this.token = data.token;
    }
  }

  async getProfiles(): Promise<Profile[]> {
    const response = await fetch(`${this.baseURL}/api/profiles`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    return response.json();
  }
}
```

### Python

```python
import requests

class ZentrioAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None

    def authenticate(self, email):
        response = requests.post(
            f"{self.base_url}/api/auth/magic-link",
            json={"email": email}
        )
        response.raise_for_status()

    def verify_token(self, token):
        response = requests.get(f"{self.base_url}/api/auth/verify?token={token}")
        data = response.json()
        if data.get("success"):
            self.token = data["token"]

    def get_profiles(self):
        response = requests.get(
            f"{self.base_url}/api/profiles",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return response.json()
```

## 🔍 Testing the API

### Using curl

```bash
# Health check
curl https://yourdomain.com/health

# Get themes (no auth required)
curl https://yourdomain.com/api/themes

# Request magic link
curl -X POST https://yourdomain.com/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Using Postman

Import the following collection:

```json
{
  "info": {
    "name": "Zentrio API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://yourdomain.com"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

## 📊 Data Models

### User
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Profile
```json
{
  "id": "profile_id",
  "name": "Profile Name",
  "stremioId": "stremio_id",
  "avatar": "avatar_url",
  "settings": {
    "theme": "dark",
    "nsfwFilter": false,
    "addonOrder": ["addon1", "addon2"],
    "hiddenButtons": ["calendar", "addons"]
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Theme
```json
{
  "name": "zentrio",
  "displayName": "Zentrio",
  "colors": {
    "primary": "#0366d6",
    "secondary": "#586069",
    "background": "#ffffff",
    "surface": "#f6f8fa",
    "text": "#24292e",
    "textSecondary": "#586069"
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

## 🔄 Webhooks

Zentrio supports webhooks for real-time notifications:

### Configure Webhooks

Set webhook URL in environment variables:

```bash
WEBHOOK_URL=https://yourdomain.com/webhook
WEBHOOK_SECRET=your-webhook-secret
```

### Webhook Events

- `profile.created` - New profile created
- `profile.updated` - Profile updated
- `profile.deleted` - Profile deleted
- `user.updated` - User information updated

### Webhook Payload

```json
{
  "event": "profile.created",
  "data": {
    "profile": { ... },
    "user": { ... }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 📚 Additional Resources

- [Development Guide](../development/) - Learn about contributing to Zentrio
- [Configuration Reference](../reference/configuration.md) - Complete configuration options
- [Troubleshooting](../user-guide/troubleshooting.md) - Common issues and solutions

## 🆘 Getting Help

- **API Issues**: [Report API bugs](https://github.com/MichielEijpe/Zentrio/issues)
- **Questions**: [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)
- **Documentation**: [Full documentation](../)

---

Ready to integrate with Zentrio? Start with our [Authentication Guide](authentication.md) to understand the authentication flow!