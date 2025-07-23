# Security Setup Guide

This application uses AES-256-GCM encryption to securely store sensitive data including Stremio passwords and TMDB API keys. This guide explains how to set up the encryption environment.

## Environment Variables

### Required: Encryption Master Key

You must set the `ENCRYPTION_MASTER_KEY` environment variable before running the application. This key is used to derive all encryption keys and must be:

- At least 32 characters long
- Kept completely secret
- Backed up securely (if lost, all encrypted data becomes inaccessible)

#### Generate a Master Key

You can generate a secure master key using the built-in utility:

```javascript
// Run this in a Deno REPL or create a script
import { EncryptionService } from "./app/shared/services/encryption.ts";
console.log("Generated master key:", EncryptionService.generateMasterKey());
```

Or use any secure method to generate a 64-character hexadecimal string.

#### Set the Environment Variable

**Development (.env file):**
```
ENCRYPTION_MASTER_KEY=your_64_character_hex_string_here
```

**Production:**
Set the environment variable in your hosting platform's configuration.

**Local Development:**
```bash
export ENCRYPTION_MASTER_KEY="your_64_character_hex_string_here"
```

## Security Features

### Password Encryption
- All Stremio passwords are encrypted using AES-256-GCM
- Each password uses a unique salt and initialization vector
- PBKDF2 with 100,000 iterations for key derivation
- Backward compatibility with existing unencrypted passwords

### TMDB API Key Encryption
- User TMDB API keys are encrypted at the user level
- Same encryption standards as passwords
- Keys are decrypted only when needed for API calls

### Migration
- Existing profiles with unencrypted passwords will be automatically migrated
- Migration happens when the profile is next accessed
- Old unencrypted data is removed after successful migration

## Testing Encryption

The application includes built-in encryption testing:

```javascript
import { testDatabaseEncryption } from "./app/utils/db.ts";

// Returns true if encryption is working correctly
const isWorking = await testDatabaseEncryption();
console.log("Encryption test:", isWorking ? "PASSED" : "FAILED");
```

## Security Best Practices

1. **Master Key Storage:**
   - Store the master key in a secure environment variable system
   - Never commit the master key to version control
   - Use different keys for development and production

2. **Key Rotation:**
   - Plan for periodic master key rotation
   - Keep previous keys available during migration periods
   - Test decryption with backup keys regularly

3. **Database Security:**
   - Encrypted data in the database is still sensitive
   - Use database-level encryption and access controls
   - Regular security audits of database permissions

4. **Application Security:**
   - Ensure HTTPS/TLS in production
   - Implement proper session management
   - Regular security updates for dependencies

## Troubleshooting

### "ENCRYPTION_MASTER_KEY environment variable is required"
- Set the `ENCRYPTION_MASTER_KEY` environment variable
- Ensure the key is at least 32 characters long

### "Decryption failed" errors
- Check that the master key hasn't changed
- Verify the encrypted data hasn't been corrupted
- Check for encoding/character set issues

### Migration Issues
- Check application logs for specific migration errors
- Ensure the database connection is stable
- Verify the encryption service is properly initialized

## Database Schema

### Encrypted Fields Structure
```typescript
{
  encrypted: string,  // Base64 encoded encrypted data
  salt: string,       // Base64 encoded salt
  iv: string,         // Base64 encoded initialization vector
  tag: string         // Authentication tag (included in encrypted data for GCM)
}
```

### Profile Schema
- `password`: Legacy unencrypted field (deprecated)
- `encryptedPassword`: New encrypted password field
- Migration removes `password` after successful encryption

### User Schema
- `encryptedTmdbApiKey`: Encrypted TMDB API key storage

## Monitoring

Monitor these metrics for security health:
- Failed decryption attempts
- Migration success/failure rates
- API key usage patterns
- Database access patterns

## Recovery Procedures

### Lost Master Key
If the master key is lost:
1. All encrypted data becomes permanently inaccessible
2. Users must re-enter their Stremio passwords
3. TMDB API keys must be re-entered
4. Generate a new master key and update environment

### Corrupted Encrypted Data
1. Check database backups
2. Attempt decryption with backup keys
3. Reset affected user data if necessary
4. Notify affected users to re-enter credentials

## Compliance

This encryption implementation provides:
- AES-256-GCM encryption (industry standard)
- Proper key derivation (PBKDF2 with 100k iterations)
- Unique salts per encryption operation
- Authentication and integrity protection
- Defense against rainbow table attacks

The system is designed to meet security requirements for storing sensitive user credentials while maintaining usability and performance.