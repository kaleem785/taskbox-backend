export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  frontendOrigin: string;
  database: {
    url: string;
    directUrl?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  applicationUpload: {
    /** Dedicated secret for short-lived scoped upload tokens issued by POST /partners/apply. */
    secret: string;
    /** TTL for the scoped upload token. */
    ttl: string;
  };
  r2: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    /**
     * Public read URL for bucket objects (e.g. R2.dev subdomain or custom domain).
     * Persisted URLs are built as `${publicBaseUrl}/${key}` and served without signing.
     * If empty, the backend will still upload but cannot return a usable public URL.
     */
    publicBaseUrl: string;
  };
  redis: {
    url: string;
  };
  email: {
    resendApiKey: string;
    from: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DIRECT_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  applicationUpload: {
    // Falls back to the access secret with a namespace suffix so dev works
    // out of the box; set a dedicated secret in production.
    secret:
      process.env.APPLICATION_UPLOAD_SECRET ??
      `${process.env.JWT_ACCESS_SECRET ?? ''}:application-upload`,
    ttl: process.env.APPLICATION_UPLOAD_TTL ?? '30m',
  },
  r2: {
    endpoint: process.env.R2_ENDPOINT ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    region: process.env.R2_REGION ?? 'auto',
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'TaskBox <no-reply@taskbox.pk>',
  },
});
