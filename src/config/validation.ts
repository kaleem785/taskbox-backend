import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  FRONTEND_ORIGIN: Joi.string()
    .custom((value: string, helpers) => {
      const parts = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 0) return helpers.error('any.invalid');
      for (const part of parts) {
        if (part === '*') continue;
        const { error } = Joi.string().uri().validate(part);
        if (error) return helpers.error('any.invalid');
      }
      return value;
    }, 'comma-separated URI list')
    .default('http://localhost:5173'),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  DIRECT_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  R2_ENDPOINT: Joi.string().uri().allow('').default(''),
  R2_BUCKET: Joi.string().allow('').default(''),
  R2_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  R2_REGION: Joi.string().default('auto'),
  R2_PUBLIC_BASE_URL: Joi.string().uri().allow('').default(''),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).allow('').default(''),

  RESEND_API_KEY: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.string().default('TaskBox <no-reply@taskbox.pk>'),

  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).optional(),
  SEED_EXAMINER_EMAIL: Joi.string().email().optional(),
  SEED_EXAMINER_PASSWORD: Joi.string().min(8).optional(),
});
