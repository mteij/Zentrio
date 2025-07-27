import { Handlers } from "$fresh/server.ts";
import { testDatabaseEncryption } from "../utils/db.ts";
import { connect } from "../utils/mongo.ts";

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: {
      status: "connected" | "disconnected" | "error";
      responseTime?: number;
    };
    encryption: {
      status: "working" | "failed";
      tested: boolean;
    };
    email: {
      status: "configured" | "not_configured";
      domain?: string;
    };
    environment: {
      status: "production" | "development";
      secure: boolean;
    };
  };
  security: {
    rateLimiting: boolean;
    sessionSecurity: boolean;
    encryptionEnabled: boolean;
    securityHeaders: boolean;
  };
  metadata: {
    nodeVersion: string;
    denoVersion: string;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  issues?: string[];
  responseTime?: number;
}

export const handler: Handlers = {
  async GET(_req) {
    const startTime = Date.now();
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";
    const issues: string[] = [];

    // Database health check
    let dbStatus: "connected" | "disconnected" | "error" = "disconnected";
    let dbResponseTime: number | undefined;
    
    try {
      const dbStart = Date.now();
      await connect(); // Test database connection
      dbResponseTime = Date.now() - dbStart;
      dbStatus = "connected";
    } catch (error) {
      console.error("Database health check failed:", error);
      dbStatus = "error";
      overallStatus = "unhealthy";
      issues.push("Database connection failed");
    }

    // Encryption health check
    let encryptionStatus: "working" | "failed" = "failed";
    let encryptionTested = false;
    
    try {
      encryptionTested = await testDatabaseEncryption();
      encryptionStatus = encryptionTested ? "working" : "failed";
      if (!encryptionTested) {
        overallStatus = "unhealthy";
        issues.push("Encryption system failed");
      }
    } catch (error) {
      console.error("Encryption health check failed:", error);
      encryptionStatus = "failed";
      overallStatus = "unhealthy";
      issues.push("Encryption test error");
    }

    // Email service health check
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailDomain = Deno.env.get("EMAIL_FROM_DOMAIN");
    const emailStatus = resendApiKey ? "configured" : "not_configured";
    
    if (!resendApiKey) {
      overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
      issues.push("Email service not configured");
    }

    // Environment checks
    const encryptionMasterKey = Deno.env.get("ENCRYPTION_MASTER_KEY");
    const mongoUri = Deno.env.get("MONGO_URI");
    const isProduction = Deno.env.get("NODE_ENV") === "production" ||
                        Deno.env.get("DENO_ENV") === "production";
    
    const environmentSecure = !!(encryptionMasterKey && mongoUri);
    if (!environmentSecure) {
      overallStatus = "unhealthy";
      issues.push("Critical environment variables missing");
    }

    // Memory usage
    const memoryUsage = Deno.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

    // If memory usage is too high, mark as degraded
    if (memoryPercentage > 85) {
      overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
      issues.push("High memory usage");
    }

    const healthData: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(performance.now() / 1000), // Uptime in seconds
      version: "1.0.0", // You can read this from a package.json or set it dynamically
      services: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
        },
        encryption: {
          status: encryptionStatus,
          tested: encryptionTested,
        },
        email: {
          status: emailStatus,
          domain: emailDomain,
        },
        environment: {
          status: isProduction ? "production" : "development",
          secure: environmentSecure,
        },
      },
      security: {
        rateLimiting: true, // We implemented this
        sessionSecurity: true, // We implemented this
        encryptionEnabled: !!encryptionMasterKey,
        securityHeaders: true, // We implemented this
      },
      metadata: {
        nodeVersion: "N/A", // Deno doesn't use Node.js
        denoVersion: Deno.version.deno,
        memoryUsage: {
          used: Math.round(usedMemory / 1024 / 1024), // MB
          total: Math.round(totalMemory / 1024 / 1024), // MB
          percentage: memoryPercentage,
        },
      },
    };

    // Add issues to response if any
    if (issues.length > 0) {
      healthData.issues = issues;
    }

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (overallStatus === "degraded") {
      statusCode = 200; // Still OK but with warnings
    } else if (overallStatus === "unhealthy") {
      statusCode = 503; // Service Unavailable
    }

    // Add response time
    healthData.responseTime = Date.now() - startTime;

    return new Response(JSON.stringify(healthData, null, 2), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  },
};