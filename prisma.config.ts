import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const databaseUrl = process.env.DIRECT_URL ?? env('DATABASE_URL');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
