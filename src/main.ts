import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { timingSafeEqual } from 'crypto';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.use(helmet());

  const origins = config
    .getOrThrow<string>('frontendOrigin')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
      if (!origin || origins.includes(origin) || origins.includes('*')) cb(null, true);
      else cb(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  // Gate Swagger behind basic auth in production
  const isProd = config.get<string>('nodeEnv') === 'production';
  const docsUser = process.env.DOCS_BASIC_AUTH_USER;
  const docsPass = process.env.DOCS_BASIC_AUTH_PASS;
  if (isProd && docsUser && docsPass) {
    app.use('/docs', (req: Request, res: Response, next: NextFunction) => {
      const header = req.headers.authorization;
      if (!header?.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="docs"');
        res.status(401).send('Authentication required');
        return;
      }
      const [user, pass] = Buffer.from(header.slice(6), 'base64').toString().split(':');
      const ok =
        constantTimeEq(user ?? '', docsUser) && constantTimeEq(pass ?? '', docsPass);
      if (!ok) {
        res.setHeader('WWW-Authenticate', 'Basic realm="docs"');
        res.status(401).send('Invalid credentials');
        return;
      }
      next();
    });
  } else if (isProd) {
    // In production with no creds, disable docs entirely
    app.use('/docs', (_req: Request, res: Response) => {
      res.status(404).send('Not Found');
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TaskBox API')
    .setDescription('Backend for the TaskBox service-marketplace platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.getOrThrow<number>('port');
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`TaskBox API listening on http://localhost:${port}`);
  logger.log(`Swagger UI at http://localhost:${port}/docs`);
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

void bootstrap();
