import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ── Geography seed (mirrors TaskBox-Admin/src/app/data/pakistanCities.ts) ────

const CITIES_BY_PROVINCE: Record<string, string[]> = {
  Punjab: [
    'Lahore',
    'Faisalabad',
    'Rawalpindi',
    'Multan',
    'Gujranwala',
    'Sialkot',
    'Bahawalpur',
    'Sargodha',
    'Sheikhupura',
  ],
  Sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah'],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Mardan', 'Abbottabad'],
  Balochistan: ['Quetta', 'Gwadar'],
  'Federal Capital': ['Islamabad'],
};

const ZONES_BY_CITY_SLUG: Record<string, string[]> = {
  lahore: [
    'Gulberg',
    'DHA Phase 1',
    'DHA Phase 2',
    'Johar Town',
    'Model Town',
    'Cantt',
    'Wapda Town',
    'Iqbal Town',
    'Bahria Town',
  ],
  karachi: [
    'Clifton',
    'Defence',
    'Gulshan-e-Iqbal',
    'Nazimabad',
    'Korangi',
    'Saddar',
    'Gulistan-e-Johar',
    'PECHS',
  ],
  islamabad: [
    'F-6',
    'F-7',
    'F-8',
    'F-10',
    'G-6',
    'G-7',
    'G-9',
    'I-8',
    'I-10',
    'Bahria Town',
    'DHA',
  ],
};

// ── Categories seed (mirrors mockData.ts categoriesData) ─────────────────────

const CATEGORIES = [
  {
    slug: 'ac-services',
    name: 'AC Services',
    icon: 'snowflake',
    color: '#FF6F00',
    description: 'Professional AC installation, repair, and maintenance services',
    displayOrder: 1,
    priceRangeMin: 800,
    priceRangeMax: 5000,
  },
  {
    slug: 'plumbing',
    name: 'Plumbing',
    icon: 'droplet',
    color: '#1E88E5',
    description: 'Expert plumbing solutions for homes and offices',
    displayOrder: 2,
    priceRangeMin: 500,
    priceRangeMax: 4500,
  },
  {
    slug: 'electrical',
    name: 'Electrical',
    icon: 'zap',
    color: '#FFB800',
    description: 'Certified electricians for all electrical needs',
    displayOrder: 3,
    priceRangeMin: 600,
    priceRangeMax: 6000,
  },
  {
    slug: 'cleaning',
    name: 'Cleaning',
    icon: 'sparkles',
    color: '#00E096',
    description: 'Deep cleaning and sanitization services',
    displayOrder: 4,
    priceRangeMin: 1000,
    priceRangeMax: 8000,
  },
  {
    slug: 'painting',
    name: 'Painting',
    icon: 'paintbrush',
    color: '#B464FF',
    description: 'Professional interior and exterior painting',
    displayOrder: 5,
    priceRangeMin: 2000,
    priceRangeMax: 15000,
  },
  {
    slug: 'carpentry',
    name: 'Carpentry',
    icon: 'hammer',
    color: '#FF6464',
    description: 'Custom furniture and carpentry solutions',
    displayOrder: 6,
    priceRangeMin: 1500,
    priceRangeMax: 25000,
  },
  {
    slug: 'pest-control',
    name: 'Pest Control',
    icon: 'bug',
    color: '#64C864',
    description: 'Safe and effective pest elimination services',
    displayOrder: 7,
    priceRangeMin: 1200,
    priceRangeMax: 5000,
  },
  {
    slug: 'appliances',
    name: 'Appliances',
    icon: 'wrench',
    color: '#64B4FF',
    description: 'Repair and maintenance for all home appliances',
    displayOrder: 8,
    priceRangeMin: 700,
    priceRangeMax: 7000,
  },
];

const SUB_CATEGORIES_BY_CATEGORY_SLUG: Record<
  string,
  { slug: string; name: string; description: string }[]
> = {
  'ac-services': [
    { slug: 'ac-repair', name: 'AC Repair', description: 'Repair and troubleshooting' },
    {
      slug: 'ac-installation',
      name: 'AC Installation',
      description: 'New AC installation services',
    },
    { slug: 'ac-gas-refill', name: 'AC Gas Refill', description: 'Refrigerant top-up' },
    {
      slug: 'ac-maintenance',
      name: 'AC Maintenance',
      description: 'Regular preventive servicing',
    },
  ],
  plumbing: [
    { slug: 'pipe-repair', name: 'Pipe Repair', description: 'Leak and burst pipe repairs' },
    { slug: 'drainage', name: 'Drainage', description: 'Drain unclogging and cleaning' },
    {
      slug: 'bathroom-fitting',
      name: 'Bathroom Fitting',
      description: 'Toilet, sink, shower installation',
    },
  ],
  electrical: [
    { slug: 'wiring', name: 'Wiring', description: 'Installation and rewiring' },
    {
      slug: 'switch-socket-repair',
      name: 'Switch & Socket Repair',
      description: 'Replace faulty switches and sockets',
    },
  ],
  cleaning: [
    { slug: 'deep-cleaning', name: 'Deep Cleaning', description: 'Full home deep clean' },
    {
      slug: 'regular-cleaning',
      name: 'Regular Cleaning',
      description: 'Weekly recurring cleaning',
    },
  ],
};

// ── Seed runners ─────────────────────────────────────────────────────────────

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@taskbox.pk';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const examinerEmail = process.env.SEED_EXAMINER_EMAIL ?? 'examiner@taskbox.pk';
  const examinerPassword = process.env.SEED_EXAMINER_PASSWORD ?? 'ChangeMe!2026';

  await upsertUser(adminEmail, adminPassword, 'TaskBox Admin', Role.ADMIN);
  await upsertUser(examinerEmail, examinerPassword, 'TaskBox Examiner', Role.EXAMINER);
  console.log(`  Users: admin (${adminEmail}), examiner (${examinerEmail})`);
}

async function upsertUser(email: string, password: string, name: string, role: Role) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: { email: email.toLowerCase(), passwordHash, name, role },
  });
}

async function seedCities() {
  let count = 0;
  for (const [province, cityNames] of Object.entries(CITIES_BY_PROVINCE)) {
    for (const name of cityNames) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.city.upsert({
        where: { slug },
        update: {},
        create: { slug, name, province },
      });
      count++;
    }
  }
  console.log(`  Cities: ${count}`);
}

async function seedZones() {
  let zoneCount = 0;
  let areaCount = 0;
  for (const [citySlug, zoneNames] of Object.entries(ZONES_BY_CITY_SLUG)) {
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    if (!city) continue;
    for (let i = 0; i < zoneNames.length; i++) {
      const name = zoneNames[i];
      const zone = await prisma.zone.upsert({
        where: { cityId_name: { cityId: city.id, name } },
        update: {},
        create: { cityId: city.id, name, displayOrder: i },
      });
      zoneCount++;
      // Seed one area equal to the zone name as a sensible default
      try {
        await prisma.zoneArea.upsert({
          where: { zoneId_name: { zoneId: zone.id, name } },
          update: {},
          create: { zoneId: zone.id, name },
        });
        areaCount++;
      } catch {
        /* already exists */
      }
    }
  }
  console.log(`  Zones: ${zoneCount}, ZoneAreas: ${areaCount}`);
}

async function seedCatalog() {
  let catCount = 0;
  let subCount = 0;
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    catCount++;
    const subs = SUB_CATEGORIES_BY_CATEGORY_SLUG[cat.slug] ?? [];
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      await prisma.subCategory.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: sub.slug } },
        update: {},
        create: {
          categoryId: category.id,
          slug: sub.slug,
          name: sub.name,
          description: sub.description,
          displayOrder: i,
        },
      });
      subCount++;
    }
  }
  console.log(`  Categories: ${catCount}, SubCategories: ${subCount}`);
}

async function main() {
  console.log('Seeding TaskBox database…');
  await seedUsers();
  await seedCities();
  await seedZones();
  await seedCatalog();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
