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
  private get maxSessionAge(): number {
    if (typeof window !== "undefined") {
      const days = parseFloat(localStorage.getItem("sessionLengthDays") || "30");
      return days === 0 ? Infinity : days * 24 * 60 * 60 * 1000;
    }
    return 30 * 24 * 60 * 60 * 1000; // Default 30 days
  }
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
    const acceptLanguage = headers.get('accept-language') ?? undefined;
    const fingerprint = this.createFingerprint(userAgent, acceptLanguage);

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
    if (this.maxSessionAge === Infinity) {
      return false; // Never expires
    }
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
   * @param allowFraming - Whether to allow iframe embedding (default: false for security)
   * @param allowCORS - Whether to allow cross-origin requests (default: false for security)
   */
  createSecurityHeaders(allowFraming: boolean = false, allowCORS: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };

    // Add CORS headers if needed
    if (allowCORS) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, HEAD, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Fully permissive CSP for all cases
    headers['Content-Security-Policy'] = [
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
      "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
      "style-src * 'unsafe-inline' data: blob:;",
      "img-src * data: blob:;",
      "font-src * data:;",
      "connect-src * data: blob:;",
      "media-src * blob:;",
      "object-src *;",
      "child-src *;",
      "frame-src *;",
      "frame-ancestors *;",
      "worker-src * blob:;",
      "manifest-src *;"
    ].join(' ');

    return headers;
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
