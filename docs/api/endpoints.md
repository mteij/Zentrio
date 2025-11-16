# API Endpoints

Reference for all Zentrio API endpoints.

## Base URL

```
https://yourdomain.com
```

## Authentication

All API endpoints (except health check) require authentication via JWT token.

```http
Authorization: Bearer <jwt_token>
```

## Authentication Endpoints

### Send Magic Link

Send a magic link to user's email for authentication.

```http
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

### Verify Token

Verify a magic link token and receive JWT.

```http
GET /api/auth/verify?token=<token>
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

### Refresh Token

Refresh an existing JWT token.

```http
POST /api/auth/refresh
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "token": "new_jwt_token"
}
```

## Profile Endpoints

### Get All Profiles

Retrieve all profiles for the authenticated user.

```http
GET /api/profiles
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "profiles": [
    {
      "id": "profile_id",
      "name": "Profile Name",
      "stremioId": "stremio_user_id",
      "avatar": "avatar_url",
      "settings": {
        "theme": "dark",
        "nsfwFilter": false
      }
    }
  ]
}
```

### Create Profile

Create a new profile.

```http
POST /api/profiles
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "New Profile",
  "stremioId": "stremio_user_id",
  "settings": {
    "theme": "dark"
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
    }
  }
}
```

### Update Profile

Update an existing profile.

```http
PUT /api/profiles/<profile_id>
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "settings": {
    "theme": "light"
  }
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "profile_id",
    "name": "Updated Name",
    "settings": {
      "theme": "light"
    }
  }
}
```

### Delete Profile

Delete a profile.

```http
DELETE /api/profiles/<profile_id>
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile deleted"
}
```

## Avatar Endpoints

### Upload Avatar

Upload an avatar for a profile.

```http
POST /api/avatar/<profile_id>
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

avatar: <file>
```

**Response:**
```json
{
  "success": true,
  "avatar": "avatar_url"
}
```

### Delete Avatar

Remove a profile's avatar.

```http
DELETE /api/avatar/<profile_id>
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Avatar deleted"
}
```

## Theme Endpoints

### Get All Themes

Retrieve available themes.

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
        "background": "#ffffff"
      }
    }
  ]
}
```

### Get Theme

Get a specific theme.

```http
GET /api/themes/<theme_name>
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
    "text": "#24292e"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontSize": {
      "base": "16px",
      "lg": "18px"
    }
  }
}
```

## Stremio Integration

### Get Manifest

Stremio addon manifest.

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

### Stream Proxy

Proxy Stremio stream requests with profile context.

```http
POST /stremio/stream/<type>/<id>
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

## System Endpoints

### Health Check

Check system health.

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

Get system information.

```http
GET /api/system/info
Authorization: Bearer <jwt_token>
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

## Error Responses

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
| UNAUTHORIZED | 401 | Invalid or missing authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Rate Limiting

API requests are rate limited:
- Window: 15 minutes
- Limit: 100 requests per window
- Headers included: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## SDK Examples

See [API Examples](examples.md) for code samples in various languages.

For authentication details, see [Authentication Guide](authentication.md).