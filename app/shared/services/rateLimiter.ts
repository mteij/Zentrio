/**
 * Rate Limiting Service
 * Prevents brute force attacks and abuse
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

class RateLimiterService {
  private attempts: Map<string, RateLimitEntry> = new Map();
  
  // Default configurations for different endpoints
  private readonly configs = {
    login: { windowMs: 15 * 60 * 1000, maxAttempts: 5, blockDurationMs: 30 * 60 * 1000 }, // 5 attempts per 15min, block 30min
    signup: { windowMs: 60 * 60 * 1000, maxAttempts: 3, blockDurationMs: 60 * 60 * 1000 }, // 3 attempts per hour, block 1 hour
    api: { windowMs: 60 * 1000, maxAttempts: 100, blockDurationMs: 5 * 60 * 1000 }, // 100 requests per minute, block 5 min
    password_reset: { windowMs: 60 * 60 * 1000, maxAttempts: 3, blockDurationMs: 2 * 60 * 60 * 1000 }, // 3 per hour, block 2 hours
  };

  /**
   * Get client identifier from request
   */
  private getClientId(request: Request, type: string): string {
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    // Combine IP and partial user agent for fingerprinting
    return `${type}:${ip}:${userAgent.slice(0, 50)}`;
  }

  /**
   * Extract client IP address
   */
  private getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfIP = request.headers.get('cf-connecting-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIP) {
      return realIP;
    }
    if (cfIP) {
      return cfIP;
    }
    
    return 'unknown';
  }

  /**
   * Check if request should be rate limited
   */
  isRateLimited(request: Request, type: keyof typeof this.configs): {
    limited: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const config = this.configs[type];
    const clientId = this.getClientId(request, type);
    const now = Date.now();
    
    let entry = this.attempts.get(clientId);
    
    // Clean up expired entries
    if (entry && now > entry.resetTime) {
      entry = undefined;
      this.attempts.delete(clientId);
    }

    // Check if client is currently blocked
    if (entry?.blocked && now < entry.resetTime) {
      return {
        limited: true,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      };
    }

    // Initialize or reset entry if needed
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxAttempts) {
      entry.blocked = true;
      entry.resetTime = now + config.blockDurationMs;
      this.attempts.set(clientId, entry);
      
      return {
        limited: true,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil(config.blockDurationMs / 1000)
      };
    }

    const remaining = config.maxAttempts - entry.count;
    return {
      limited: false,
      remaining,
      resetTime: entry.resetTime
    };
  }

  /**
   * Record an attempt (should be called after checking rate limit)
   */
  recordAttempt(request: Request, type: keyof typeof this.configs): void {
    const config = this.configs[type];
    const clientId = this.getClientId(request, type);
    const now = Date.now();
    
    let entry = this.attempts.get(clientId);
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        blocked: false
      };
    } else {
      entry.count++;
    }
    
    this.attempts.set(clientId, entry);
  }

  /**
   * Record a successful operation (can be used to reset counter on success)
   */
  recordSuccess(request: Request, type: keyof typeof this.configs): void {
    const clientId = this.getClientId(request, type);
    // Remove or reset the entry on successful operation
    this.attempts.delete(clientId);
  }

  /**
   * Create rate limit headers for response
   */
  createRateLimitHeaders(request: Request, type: keyof typeof this.configs): Record<string, string> {
    const result = this.isRateLimited(request, type);
    
    return {
      'X-RateLimit-Limit': this.configs[type].maxAttempts.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() })
    };
  }

  /**
   * Middleware function to check rate limits
   */
  checkRateLimit(type: keyof typeof this.configs) {
    return (request: Request): Response | null => {
      const result = this.isRateLimited(request, type);
      
      if (result.limited) {
        const headers = this.createRateLimitHeaders(request, type);
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            }
          }
        );
      }

      // Record the attempt
      this.recordAttempt(request, type);
      return null; // Not rate limited
    };
  }

  /**
   * Clean up old entries (should be called periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.attempts.entries()) {
      if (now > entry.resetTime && !entry.blocked) {
        this.attempts.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get current stats (for monitoring)
   */
  getStats(): {
    totalEntries: number;
    blockedEntries: number;
    activeEntries: number;
  } {
    const now = Date.now();
    let blocked = 0;
    let active = 0;
    
    for (const entry of this.attempts.values()) {
      if (entry.blocked && now < entry.resetTime) {
        blocked++;
      }
      if (now < entry.resetTime) {
        active++;
      }
    }
    
    return {
      totalEntries: this.attempts.size,
      blockedEntries: blocked,
      activeEntries: active
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiterService();

// Cleanup interval (run every 5 minutes)
setInterval(() => {
  const cleaned = rateLimiter.cleanup();
  if (cleaned > 0) {
    console.log(`Rate limiter cleaned up ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);