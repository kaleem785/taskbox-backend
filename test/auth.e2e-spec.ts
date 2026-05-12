import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/modules/users/users.service';

const SEED_PASSWORD = 'E2eTestPass!2026';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let users: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = app.get(PrismaService);
    users = app.get(UsersService);

    // Ensure deterministic test user exists
    const email = 'e2e@taskbox.pk';
    const existing = await users.findByEmail(email);
    if (existing) {
      await users.updatePassword(existing.id, SEED_PASSWORD);
    } else {
      await users.create({
        email,
        password: SEED_PASSWORD,
        name: 'E2E User',
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects login with bad password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@taskbox.pk', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('logs in, refreshes (with rotation), and detects reuse', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@taskbox.pk', password: SEED_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeDefined();
    const refresh1 = login.body.data.refreshToken;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('e2e@taskbox.pk');

    const rot = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refresh1 });
    expect(rot.status).toBe(200);
    const refresh2 = rot.body.data.refreshToken;
    expect(refresh2).not.toBe(refresh1);

    // Reuse of original refresh token must fail
    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refresh1 });
    expect(reuse.status).toBe(401);

    // After reuse detection, refresh2 is also revoked
    const after = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refresh2 });
    expect(after.status).toBe(401);
  });

  it('blocks protected endpoint without bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
