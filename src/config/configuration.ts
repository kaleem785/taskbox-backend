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
  r2: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
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
  r2: {
    endpoint: process.env.R2_ENDPOINT ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    region: process.env.R2_REGION ?? 'auto',
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'TaskBox <no-reply@taskbox.pk>',
  },
});
