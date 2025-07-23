/**
 * Session Security Service
 * Provides comprehensive session validation and security measures
 */

interface SessionSecurityData {
  ipAddress?: string;
  userAgent?: string;
  fingerprint?: string;
}

interface SecureSessionData {
  userId: string;
  sessionId: string;
  expiresAt: Date;
  securityData: SessionSecurityData;
  lastActivity: Date;
  isActive: boolean;
}

class SessionSecurityService {
  private readonly maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly inactivityTimeout = 2 * 60 * 60 * 1000; // 2 hours
  private readonly maxConcurrentSessions = 5; // Max sessions per user

  /**
   * Extract security data from request headers
   */
  extractSecurityData(request: Request): SessionSecurityData {
    const headers = request.headers;
    
    // Get client IP (handle various proxy headers)
    const ipAddress = headers.get('x-forwarded-for') || 
                     headers.get('x-real-ip') || 
                     headers.get('cf-connecting-ip') ||
                     'unknown';

    const userAgent = headers.get('user-agent') || 'unknown';
    
    // Create a simple fingerprint from stable headers
    const fingerprint = this.createFingerprint(userAgent, headers.get('accept-language'));

    return {
      ipAddress: ipAddress.split(',')[0].trim(), // Take first IP if comma-separated
      userAgent,
      fingerprint
    };
  }

  /**
   * Create a browser fingerprint for additional validation
   */
  private createFingerprint(userAgent?: string, acceptLanguage?: string): string {
    const data = `${userAgent || 'unknown'}-${acceptLanguage || 'unknown'}`;
    return btoa(data).slice(0, 32); // Simple base64 fingerprint
  }

  /**
   * Validate session security context
   */
  validateSessionSecurity(
    storedSecurityData: SessionSecurityData,
    currentSecurityData: SessionSecurityData
  ): { isValid: boolean; reason?: string } {
    // IP address validation (allow for dynamic IPs within reasonable bounds)
    if (storedSecurityData.ipAddress && currentSecurityData.ipAddress) {
      if (storedSecurityData.ipAddress !== currentSecurityData.ipAddress) {
        // Allow IP changes but log them for monitoring
        console.warn(`IP address changed for session: ${storedSecurityData.ipAddress} -> ${currentSecurityData.ipAddress}`);
      }
    }

    // User agent validation (strict - shouldn't change during session)
    if (storedSecurityData.userAgent && currentSecurityData.userAgent) {
      if (storedSecurityData.userAgent !== currentSecurityData.userAgent) {
        return {
          isValid: false,
          reason: 'User agent mismatch detected'
        };
      }
    }

    // Fingerprint validation
    if (storedSecurityData.fingerprint && currentSecurityData.fingerprint) {
      if (storedSecurityData.fingerprint !== currentSecurityData.fingerprint) {
        return {
          isValid: false,
          reason: 'Browser fingerprint mismatch detected'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Check if session has been inactive too long
   */
  isSessionExpiredByInactivity(lastActivity: Date): boolean {
    const now = new Date();
    const timeSinceActivity = now.getTime() - lastActivity.getTime();
    return timeSinceActivity > this.inactivityTimeout;
  }

  /**
   * Check if session has exceeded maximum age
   */
  isSessionExpiredByAge(createdAt: Date): boolean {
    const now = new Date();
    const sessionAge = now.getTime() - createdAt.getTime();
    return sessionAge > this.maxSessionAge;
  }

  /**
   * Generate a cryptographically secure session ID
   */
  generateSecureSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create security headers for responses
   */
  createSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };
  }

  /**
   * Detect potential session hijacking attempts
   */
  detectSuspiciousActivity(
    sessions: SecureSessionData[],
    currentRequest: SessionSecurityData
  ): { isSuspicious: boolean; reason?: string } {
    // Check for concurrent sessions from different IPs
    const activeIPs = sessions
      .filter(s => s.isActive)
      .map(s => s.securityData.ipAddress)
      .filter(ip => ip && ip !== 'unknown');

    const uniqueIPs = new Set(activeIPs);
    
    if (uniqueIPs.size > 3) {
      return {
        isSuspicious: true,
        reason: `Too many concurrent IPs: ${uniqueIPs.size}`
      };
    }

    // Check for rapid session creation (potential brute force)
    const recentSessions = sessions.filter(s => {
      const now = new Date();
      const sessionAge = now.getTime() - s.lastActivity.getTime();
      return sessionAge < 5 * 60 * 1000; // Last 5 minutes
    });

    if (recentSessions.length > 10) {
      return {
        isSuspicious: true,
        reason: `Too many recent sessions: ${recentSessions.length}`
      };
    }

    return { isSuspicious: false };
  }

  /**
   * Clean up expired or inactive sessions
   */
  shouldCleanupSession(session: SecureSessionData): boolean {
    const now = new Date();
    
    // Session expired by time
    if (now > session.expiresAt) {
      return true;
    }

    // Session expired by inactivity
    if (this.isSessionExpiredByInactivity(session.lastActivity)) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const sessionSecurity = new SessionSecurityService();

export type { SessionSecurityData, SecureSessionData };