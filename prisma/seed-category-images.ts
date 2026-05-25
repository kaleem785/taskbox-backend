/**
 * One-off bootstrap: upload the six demo category illustrations to R2 under a stable
 * `category/seed/<slug>.png` key so the regular `prisma db seed` can reference them.
 *
 * Run once per fresh environment — NOT part of the default seed step.
 *
 *   pnpm tsx prisma/seed-category-images.ts
 *
 * Requires R2_ENDPOINT / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 * R2_PUBLIC_BASE_URL in .env. Each PNG is resized to a square 512x512 transparent
 * PNG (same pipeline the admin upload endpoint uses).
 *
 * Source PNGs live in the Admin Panel Design demo repo at
 *   ../Admin Panel Design/src/imports/<file>.png
 * which is a sibling of taskbox-backend on disk. If you have relocated the demo
 * folder, set DEMO_IMAGES_DIR to its src/imports/ path before running.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

import 'dotenv/config';

// Source file in the demo repo → destination slug used in the seed.
const FILES: Record<string, string> = {
  cleaning: 'cleaning.png',
  plumbing: 'plumbing.png',
  electrical: 'electrrician.png', // (sic) — typo preserved from the demo asset
  'ac-repair': 'AC-repair.png',
  painting: 'painting.png',
  salon: 'haircut.png',
};

const DEMO_IMAGES_DIR =
  process.env.DEMO_IMAGES_DIR ??
  path.resolve(__dirname, '../../Admin Panel Design/src/imports');

const DIMENSION = 512;

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const endpoint = envOrDie('R2_ENDPOINT');
  const bucket = envOrDie('R2_BUCKET');
  const accessKeyId = envOrDie('R2_ACCESS_KEY_ID');
  const secretAccessKey = envOrDie('R2_SECRET_ACCESS_KEY');
  const publicBaseUrl = envOrDie('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');

  const client = new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  console.log(`Uploading ${Object.keys(FILES).length} category images to ${bucket}`);
  console.log(`Source dir: ${DEMO_IMAGES_DIR}`);
  console.log(`Public base: ${publicBaseUrl}\n`);

  for (const [slug, filename] of Object.entries(FILES)) {
    const srcPath = path.join(DEMO_IMAGES_DIR, filename);
    const raw = await fs.readFile(srcPath);

    const resized = await sharp(raw)
      .resize(DIMENSION, DIMENSION, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const key = `category/seed/${slug}.png`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: resized,
        ContentType: 'image/png',
        ContentLength: resized.length,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    console.log(`  ✓ ${slug.padEnd(12)} → ${publicBaseUrl}/${key}`);
  }

  console.log('\nDone. Now run `pnpm prisma:seed` to populate Category rows.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
