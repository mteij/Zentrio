---
layout: default
title: API Reference
---

# 📚 API Reference

This document provides comprehensive API documentation for Zentrio, including all endpoints, request/response formats, and authentication methods.

## 🔐 Authentication

Zentrio uses JWT-based authentication with magic link email authentication.

### Authentication Flow

1. **Request Magic Link**: Send email to receive authentication link
2. **Verify Token**: Exchange magic link token for JWT
3. **Use JWT**: Include token in subsequent requests

### Endpoints

#### Request Magic Link

```http
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "redirectUrl": "https://yourapp.com/auth/callback"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

#### Verify Magic Link

```http
GET /api/auth/verify?token=jwt_token_here
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "jwt_token"
}
```

#### Refresh Token

```http
POST /api/auth/refresh
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "token": "new_jwt_token"
}
```

---

## 👤 User Management

### Get Current User

```http
GET /api/user
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Update User

```http
PUT /api/user
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "email": "newemail@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "newemail@example.com",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Delete User

```http
DELETE /api/user
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 👥 Profile Management

### Get All Profiles

```http
GET /api/profiles
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "profiles": [
    {
      "id": "profile_id",
      "name": "Profile Name",
      "stremioId": "stremio_id",
      "avatar": "avatar_url",
      "settings": {
        "theme": "dark",
        "nsfwFilter": false
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Profile

```http
POST /api/profiles
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "name": "New Profile",
  "stremioId": "stremio_user_id",
  "settings": {
    "theme": "dark",
    "nsfwFilter": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "new_profile_id",
    "name": "New Profile",
    "stremioId": "stremio_user_id",
    "avatar": null,
    "settings": {
      "theme": "dark",
      "nsfwFilter": false
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Get Profile

```http
GET /api/profiles/:profileId
Authorization: Bearer jwt_token
```

**Response:**
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

### Update Profile

```http
PUT /api/profiles/:profileId
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "name": "Updated Profile",
  "settings": {
    "theme": "light",
    "nsfwFilter": true,
    "addonOrder": ["addon2", "addon1"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "profile_id",
    "name": "Updated Profile",
    "stremioId": "stremio_id",
    "avatar": "avatar_url",
    "settings": {
      "theme": "light",
      "nsfwFilter": true,
      "addonOrder": ["addon2", "addon1"],
      "hiddenButtons": ["calendar", "addons"]
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Delete Profile

```http
DELETE /api/profiles/:profileId
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "message": "Profile deleted successfully"
}
```

---

## 🖼️ Avatar Management

### Upload Avatar

```http
POST /api/avatar
Authorization: Bearer jwt_token
Content-Type: multipart/form-data

avatar: [file]
profileId: profile_id
```

**Response:**
```json
{
  "success": true,
  "avatar": {
    "url": "https://yourdomain.com/avatars/profile_id.png",
    "size": 1024,
    "type": "image/png"
  }
}
```

### Get Avatar

```http
GET /api/avatar/:profileId
```

**Response:** Image file or 404 if not found

### Delete Avatar

```http
DELETE /api/avatar/:profileId
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "message": "Avatar deleted successfully"
}
```

---

## 🎨 Theme Management

### Get Available Themes

```http
GET /api/themes
```

**Response:**
```json
{
  "themes": [
    {
      "name": "zentrio",
      "displayName": "Zentrio",
      "colors": {
        "primary": "#0366d6",
        "secondary": "#586069",
        "background": "#ffffff"
      }
    },
    {
      "name": "midnight",
      "displayName": "Midnight",
      "colors": {
        "primary": "#1a1a1a",
        "secondary": "#333333",
        "background": "#000000"
      }
    }
  ]
}
```

### Get Theme

```http
GET /api/themes/:themeName
```

**Response:**
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

---

## 🔄 Stremio Integration

### Stremio Proxy

Zentrio acts as a proxy for Stremio API requests, adding profile-specific functionality.

#### Get Stremio Manifest

```http
GET /stremio/manifest.json
```

**Response:**
```json
{
  "name": "Zentrio",
  "description": "Profile management for Stremio Web",
  "version": "1.0.0",
  "catalogs": [],
  "resources": ["stream"],
  "types": ["movie", "series"],
  "id": "org.zentrio"
}
```

#### Stream Proxy

```http
POST /stremio/stream/:type/:id
Content-Type: application/json

{
  "profileId": "profile_id"
}
```

**Response:**
```json
{
  "streams": [
    {
      "title": "Stream Title",
      "url": "stream_url",
      "behaviorHints": {
        "notWebReady": true
      }
    }
  ]
}
```

---

## 📊 System Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### System Info

```http
GET /api/system/info
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "version": "1.0.0",
  "environment": "production",
  "features": {
    "downloads": false,
    "nsfwFilter": false,
    "mobileApps": true
  },
  "limits": {
    "maxProfiles": 10,
    "maxAddons": 50,
    "maxFileSize": "10MB"
  }
}
```

---

## 🚨 Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 📝 Request/Response Examples

### Profile Creation Flow

```bash
# 1. Create profile
curl -X POST https://yourdomain.com/api/profiles \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Profile",
    "stremioId": "stremio_user_123",
    "settings": {
      "theme": "dark",
      "nsfwFilter": false
    }
  }'

# Response
{
  "success": true,
  "profile": {
    "id": "profile_123",
    "name": "My Profile",
    "stremioId": "stremio_user_123",
    "avatar": null,
    "settings": {
      "theme": "dark",
      "nsfwFilter": false,
      "addonOrder": [],
      "hiddenButtons": []
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Avatar Upload

```bash
# Upload avatar
curl -X POST https://yourdomain.com/api/avatar \
  -H "Authorization: Bearer your_jwt_token" \
  -F "avatar=@profile.png" \
  -F "profileId=profile_123"

# Response
{
  "success": true,
  "avatar": {
    "url": "https://yourdomain.com/avatars/profile_123.png",
    "size": 2048,
    "type": "image/png"
  }
}
```

---

## 🔧 Rate Limiting

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

---

## 🌐 CORS

The API supports Cross-Origin Resource Sharing with configurable origins:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
```

---

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

---

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

---

For more information, see the [Development Guide](development) or open an issue on GitHub.