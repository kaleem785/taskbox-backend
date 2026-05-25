import 'dotenv/config';
import {
  PrismaClient,
  Role,
  BookingStatus,
  AssignedBy,
  PaymentStatus,
  AddressLabel,
} from '../src/prisma/client';
import { createPrismaAdapter } from '../src/prisma/prisma-adapter';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(connectionString),
});

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

const AREAS_BY_CITY_NAME: Record<string, string[]> = {
  Lahore: [
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
  Karachi: [
    'Clifton',
    'Defence',
    'Gulshan-e-Iqbal',
    'Nazimabad',
    'Korangi',
    'Saddar',
    'Gulistan-e-Johar',
    'PECHS',
  ],
  Islamabad: [
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

// ── Tabs + Badges (admin-curated discovery surfaces) ─────────────────────────

const TABS = [
  { slug: 'offers', name: 'Special Offers For You', displayOrder: 0 },
  { slug: 'popular', name: 'Popular', displayOrder: 1 },
  { slug: 'deals', name: 'Exclusive Deals', displayOrder: 2 },
];

const BADGES = [
  { slug: 'new', name: 'New', color: '#FF6F00', displayOrder: 0 },
  { slug: 'popular', name: 'Popular', color: '#1E88E5', displayOrder: 1 },
  { slug: 'trending', name: 'Trending', color: '#E91E63', displayOrder: 2 },
  { slug: 'exclusive', name: 'Exclusive', color: '#8E24AA', displayOrder: 3 },
];

// ── Categories (mirror the customer demo's six categories) ────────────────────
//
// imageUrl points at objects uploaded by the one-off `seed-category-images.ts`
// bootstrap script (run manually on a fresh environment). If R2_PUBLIC_BASE_URL is
// not set the URLs will be obviously broken (`undefined/category/seed/<slug>.png`)
// — that's intentional, so a misconfigured env fails loudly during seeding.

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
const seedImage = (slug: string) => `${PUBLIC_BASE}/category/seed/${slug}.png`;

const CATEGORIES = [
  {
    slug: 'cleaning',
    name: 'Cleaning',
    description: 'Deep cleaning and sanitization services',
    imageUrl: seedImage('cleaning'),
    displayOrder: 1,
  },
  {
    slug: 'plumbing',
    name: 'Plumbing',
    description: 'Expert plumbing solutions for homes and offices',
    imageUrl: seedImage('plumbing'),
    displayOrder: 2,
  },
  {
    slug: 'electrical',
    name: 'Electrical',
    description: 'Certified electricians for all electrical needs',
    imageUrl: seedImage('electrical'),
    displayOrder: 3,
  },
  {
    slug: 'ac-repair',
    name: 'AC Repair',
    description: 'AC installation, gas refill, and servicing',
    imageUrl: seedImage('ac-repair'),
    displayOrder: 4,
  },
  {
    slug: 'painting',
    name: 'Painting',
    description: 'Professional interior and exterior painting',
    imageUrl: seedImage('painting'),
    displayOrder: 5,
  },
  {
    slug: 'salon',
    name: 'Salon',
    description: 'At-home grooming and salon services',
    imageUrl: seedImage('salon'),
    displayOrder: 6,
  },
];

// ── Services per category (mirrors Admin Panel Design/src/app/customer/data/servicesData.ts) ──
// badgeSlug is resolved to a Badge.id at seed time; null = no badge.

type ServiceSeed = {
  key: string; // demo id, used to look up child variants
  name: string;
  price: number;
  badgeSlug: string | null;
  isPopular?: boolean;
  rating: number; // drives HomeFeature top-services pick
};

const SERVICES_BY_CATEGORY_SLUG: Record<string, ServiceSeed[]> = {
  cleaning: [
    { key: 'clean-1', name: 'Home Deep Cleaning', price: 2499, badgeSlug: 'trending', isPopular: true, rating: 4.8 },
    { key: 'clean-2', name: 'Bathroom Cleaning', price: 899, badgeSlug: null, rating: 4.7 },
    { key: 'clean-3', name: 'Sofa Carpet Clean', price: 1499, badgeSlug: 'popular', isPopular: true, rating: 4.9 },
    { key: 'clean-4', name: 'Kitchen Cleaning', price: 1299, badgeSlug: null, rating: 4.6 },
    { key: 'clean-5', name: 'Bungalow Clean Pro', price: 4999, badgeSlug: 'exclusive', rating: 4.9 },
  ],
  plumbing: [
    { key: 'plumb-1', name: 'Leak Repair', price: 1200, badgeSlug: 'popular', isPopular: true, rating: 4.7 },
    { key: 'plumb-2', name: 'Emergency Plumbing', price: 1800, badgeSlug: 'new', rating: 4.8 },
    { key: 'plumb-3', name: 'Pipe Installation', price: 2800, badgeSlug: null, rating: 4.8 },
    { key: 'plumb-4', name: 'Water Heater', price: 2200, badgeSlug: 'trending', isPopular: true, rating: 4.9 },
    { key: 'plumb-5', name: 'Bathroom Fitting', price: 3500, badgeSlug: null, rating: 4.6 },
    { key: 'plumb-6', name: 'Drainage', price: 1500, badgeSlug: null, rating: 4.5 },
    { key: 'plumb-7', name: 'Pipe Repair', price: 1800, badgeSlug: null, rating: 4.7 },
    { key: 'plumb-8', name: 'Water Tank', price: 4500, badgeSlug: 'exclusive', rating: 4.8 },
  ],
  electrical: [
    { key: 'elec-1', name: 'Wiring Repair', price: 1800, badgeSlug: 'new', rating: 4.6 },
    { key: 'elec-2', name: 'Switch & Socket Install', price: 899, badgeSlug: null, rating: 4.7 },
    { key: 'elec-3', name: 'Fan Installation', price: 1200, badgeSlug: 'popular', isPopular: true, rating: 4.8 },
    { key: 'elec-4', name: 'Light Fixture Setup', price: 1500, badgeSlug: null, rating: 4.7 },
  ],
  'ac-repair': [
    { key: 'ac-1', name: 'AC Servicing', price: 1800, badgeSlug: 'trending', isPopular: true, rating: 4.8 },
    { key: 'ac-2', name: 'Gas Refill', price: 2200, badgeSlug: null, rating: 4.7 },
    { key: 'ac-3', name: 'AC Installation', price: 3500, badgeSlug: 'new', rating: 4.9 },
  ],
  painting: [
    { key: 'paint-1', name: 'Wall Painting', price: 3500, badgeSlug: 'popular', isPopular: true, rating: 4.8 },
    { key: 'paint-2', name: 'Ceiling Paint', price: 2800, badgeSlug: null, rating: 4.6 },
    { key: 'paint-3', name: 'Exterior Painting', price: 5500, badgeSlug: 'exclusive', rating: 4.7 },
  ],
  salon: [
    { key: 'salon-1', name: 'Haircut & Styling', price: 599, badgeSlug: 'popular', isPopular: true, rating: 4.8 },
    { key: 'salon-2', name: 'Beard Grooming', price: 299, badgeSlug: 'new', rating: 4.7 },
    { key: 'salon-3', name: 'Hair Coloring', price: 1499, badgeSlug: 'trending', rating: 4.9 },
  ],
};

// ── Variant templates ────────────────────────────────────────────────────────
// Faithful child services for plumb-4..plumb-8 (from ServiceDetail.tsx childServicesMap);
// every other service gets a generic five-variant spread.

type VariantTemplate = { name: string; description: string; priceFactor: number; discountPct: number };

const CHILD_VARIANTS: Record<string, VariantTemplate[]> = {
  'plumb-4': [
    { name: 'Heater Inspection & Diagnosis', description: 'Professional inspection with detailed issue report & quote.', priceFactor: 0.3, discountPct: 20 },
    { name: 'Water Heater Tank Replacement', description: 'Complete tank replacement with installation & testing.', priceFactor: 2.5, discountPct: 25 },
    { name: 'Heating Element Repair', description: 'Element replacement for consistent hot water supply.', priceFactor: 1.2, discountPct: 15 },
    { name: 'Thermostat Replacement', description: 'Digital thermostat installation for accurate control.', priceFactor: 0.8, discountPct: 18 },
    { name: 'Pressure Relief Valve Change', description: 'Safety valve replacement to prevent tank damage.', priceFactor: 0.6, discountPct: 12 },
  ],
  'plumb-5': [
    { name: 'Faucet Installation', description: 'Modern faucet setup with leak-proof installation.', priceFactor: 0.6, discountPct: 15 },
    { name: 'Shower System Installation', description: 'Complete shower fixture setup with quality fittings.', priceFactor: 1.3, discountPct: 20 },
    { name: 'Toilet Installation & Repair', description: 'Professional toilet setup or flush mechanism repair.', priceFactor: 1.0, discountPct: 18 },
    { name: 'Vanity Sink Setup', description: 'Complete vanity installation with plumbing connections.', priceFactor: 1.5, discountPct: 22 },
    { name: 'Bathroom Accessories Setup', description: 'Towel racks, soap holders & other fixture installation.', priceFactor: 0.4, discountPct: 10 },
  ],
  'plumb-6': [
    { name: 'Drain Cleaning & Unclogging', description: 'Professional drain snake for stubborn blockages.', priceFactor: 0.8, discountPct: 15 },
    { name: 'Kitchen Sink Drainage Fix', description: 'Sink drain cleaning with grease removal treatment.', priceFactor: 0.6, discountPct: 12 },
    { name: 'Bathroom Floor Drain Cleaning', description: 'Floor drain clearing with anti-odor treatment.', priceFactor: 0.7, discountPct: 18 },
    { name: 'Main Sewer Line Service', description: 'Heavy-duty equipment for main line blockages.', priceFactor: 2.0, discountPct: 25 },
    { name: 'Complete Drainage Inspection', description: 'Camera inspection to identify hidden drain issues.', priceFactor: 1.2, discountPct: 20 },
  ],
  'plumb-7': [
    { name: 'Burst Pipe Emergency Fix', description: '24/7 emergency repair for burst pipe situations.', priceFactor: 1.8, discountPct: 10 },
    { name: 'Leak Detection & Sealing', description: 'Advanced leak detection with permanent sealing.', priceFactor: 1.0, discountPct: 15 },
    { name: 'Pipe Joint Repair', description: 'Joint connector replacement to prevent leakage.', priceFactor: 0.7, discountPct: 12 },
    { name: 'Copper Pipe Replacement', description: 'Premium copper pipe installation for durability.', priceFactor: 1.5, discountPct: 18 },
    { name: 'PVC Pipe Replacement', description: 'Modern PVC piping for long-lasting water supply.', priceFactor: 1.2, discountPct: 20 },
  ],
  'plumb-8': [
    { name: 'Water Tank Installation', description: 'Complete tank installation with stand & piping.', priceFactor: 2.2, discountPct: 25 },
    { name: 'Tank Deep Cleaning Service', description: 'Professional sanitization & sediment removal.', priceFactor: 0.7, discountPct: 18 },
    { name: 'Tank Leak Repair', description: 'Crack sealing & waterproofing for existing tanks.', priceFactor: 1.0, discountPct: 15 },
    { name: 'Float Valve Replacement', description: 'Automatic valve installation for water level control.', priceFactor: 0.5, discountPct: 12 },
    { name: 'Overhead Tank Setup', description: 'Rooftop tank installation with motor connection.', priceFactor: 2.5, discountPct: 28 },
  ],
};

const GENERIC_VARIANTS: VariantTemplate[] = [
  { name: 'Inspection & Diagnosis', description: 'On-site inspection with a detailed quote.', priceFactor: 0.3, discountPct: 18 },
  { name: 'Basic Service', description: 'Standard single-issue service visit.', priceFactor: 0.7, discountPct: 10 },
  { name: 'Standard Package', description: 'Full service with quality workmanship.', priceFactor: 1.0, discountPct: 15 },
  { name: 'Premium Package', description: 'Comprehensive service with premium materials.', priceFactor: 1.6, discountPct: 22 },
  { name: 'Express / Same-Day', description: 'Priority same-day response.', priceFactor: 1.3, discountPct: 12 },
];

function variantsFor(svc: ServiceSeed): VariantTemplate[] {
  const child = CHILD_VARIANTS[svc.key];
  if (child) return child;
  return GENERIC_VARIANTS.map((t) => ({
    ...t,
    name: `${svc.name} — ${t.name}`,
  }));
}

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
      await prisma.city.upsert({
        where: { name_province: { name, province } },
        update: {},
        create: { name, province },
      });
      count++;
    }
  }
  console.log(`  Cities: ${count}`);
}

async function seedAreasAndZones() {
  let areaCount = 0;
  let zoneCount = 0;
  const zoneSuffixes = ['Block A', 'Block B', 'Block C'];
  for (const [cityName, areaNames] of Object.entries(AREAS_BY_CITY_NAME)) {
    const city = await prisma.city.findFirst({ where: { name: cityName } });
    if (!city) continue;
    for (const name of areaNames) {
      const area = await prisma.area.upsert({
        where: { cityId_name: { cityId: city.id, name } },
        update: {},
        create: { cityId: city.id, name },
      });
      areaCount++;
      for (const suffix of zoneSuffixes) {
        await prisma.zone.upsert({
          where: { areaId_name: { areaId: area.id, name: suffix } },
          update: {},
          create: { areaId: area.id, name: suffix },
        });
        zoneCount++;
      }
    }
  }
  console.log(`  Areas: ${areaCount}, Zones: ${zoneCount}`);
}

async function seedTabs(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const t of TABS) {
    const tab = await prisma.tab.upsert({
      where: { slug: t.slug },
      update: { name: t.name, displayOrder: t.displayOrder },
      create: t,
    });
    idBySlug.set(t.slug, tab.id);
  }
  console.log(`  Tabs: ${idBySlug.size}`);
  return idBySlug;
}

async function seedBadges(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const b of BADGES) {
    const badge = await prisma.badge.upsert({
      where: { slug: b.slug },
      update: { name: b.name, color: b.color, displayOrder: b.displayOrder },
      create: b,
    });
    idBySlug.set(b.slug, badge.id);
  }
  console.log(`  Badges: ${idBySlug.size}`);
  return idBySlug;
}

async function seedCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      // Re-seeding should refresh the demo metadata (especially imageUrl after the
      // bootstrap script runs) without disturbing admin-created categories.
      update: {
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        displayOrder: cat.displayOrder,
      },
      create: cat,
    });
    idBySlug.set(cat.slug, category.id);
  }
  console.log(`  Categories: ${idBySlug.size}`);
  return idBySlug;
}

// ── Demo dataset (services, variants, packages, partners, customers, bookings) ──

const FIRST_NAMES = [
  'Ahmed', 'Ali', 'Fatima', 'Sara', 'Bilal', 'Hassan', 'Ayesha', 'Usman',
  'Zainab', 'Omar', 'Hira', 'Imran', 'Maryam', 'Tariq', 'Nida', 'Kamran',
  'Sana', 'Faisal', 'Rabia', 'Adnan',
];
const LAST_NAMES = [
  'Khan', 'Ahmed', 'Malik', 'Hussain', 'Raza', 'Sheikh', 'Butt', 'Qureshi',
  'Iqbal', 'Javed', 'Siddiqui', 'Chaudhry',
];

function fullName(i: number): string {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
}

function phone(i: number): string {
  return `+9230${(10000000 + i * 13577) % 90000000}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Delete catalog + transactional data in FK-safe order so the seed re-runs cleanly.
// Tabs/Badges/Categories are upserted (preserved); Services and everything that
// hangs off them (variants, packages, home features) are rebuilt from scratch.
async function resetSeedData() {
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.review.deleteMany();
  await prisma.commissionEvent.deleteMany();
  await prisma.commissionJob.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.partnerZone.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.homeFeature.deleteMany();
  await prisma.packageItem.deleteMany();
  await prisma.package.deleteMany();
  await prisma.variantTab.deleteMany();
  await prisma.serviceVariant.deleteMany();
  await prisma.serviceCity.deleteMany();
  await prisma.service.deleteMany();
  console.log('  Reset catalog + transactional data');
}

type SeededVariant = { id: string; discountPct: number };
type SeededService = {
  id: string;
  key: string;
  categoryId: string;
  categorySlug: string;
  price: number;
  rating: number;
  isPopular: boolean;
  badgeSlug: string | null;
  variants: SeededVariant[];
};

async function seedServicesVariantsPackages(
  categoryIdBySlug: Map<string, string>,
  tabIdBySlug: Map<string, string>,
  badgeIdBySlug: Map<string, string>,
): Promise<SeededService[]> {
  const seeded: SeededService[] = [];
  let variantCount = 0;
  let packageCount = 0;

  for (const [slug, services] of Object.entries(SERVICES_BY_CATEGORY_SLUG)) {
    const categoryId = categoryIdBySlug.get(slug)!;
    for (let s = 0; s < services.length; s++) {
      const svc = services[s];
      const service = await prisma.service.create({
        data: {
          categoryId,
          name: svc.name,
          description: `${svc.name} — professional, vetted service.`,
          price: svc.price,
          isPopular: svc.isPopular ?? false,
          displayOrder: s,
          badgeId: svc.badgeSlug ? badgeIdBySlug.get(svc.badgeSlug) : null,
        },
        select: { id: true },
      });

      // Variants
      const templates = variantsFor(svc);
      const createdVariants: SeededVariant[] = [];
      for (let v = 0; v < templates.length; v++) {
        const t = templates[v];
        // List (pre-discount) price; `price` is the net bookable amount.
        const listPrice = Math.round(svc.price * t.priceFactor);
        const netPrice = Math.round(listPrice * (1 - t.discountPct / 100));
        const variant = await prisma.serviceVariant.create({
          data: {
            serviceId: service.id,
            name: t.name,
            description: t.description,
            price: netPrice,
            originalPrice: t.discountPct > 0 ? listPrice : null,
            discountPct: t.discountPct,
            displayOrder: v,
          },
          select: { id: true },
        });
        createdVariants.push({ id: variant.id, discountPct: t.discountPct });
        variantCount++;
      }

      // VariantTab membership: top-3-by-discount → popular; discount>=20 → deals;
      // the rest → offers. (High-discount popular variants land in two tabs.)
      const ranked = [...createdVariants].sort((a, b) => b.discountPct - a.discountPct);
      const popularSet = new Set(ranked.slice(0, 3).map((v) => v.id));
      const links: { variantId: string; tabId: string }[] = [];
      for (const v of createdVariants) {
        if (popularSet.has(v.id)) links.push({ variantId: v.id, tabId: tabIdBySlug.get('popular')! });
        else links.push({ variantId: v.id, tabId: tabIdBySlug.get('offers')! });
        if (v.discountPct >= 20) links.push({ variantId: v.id, tabId: tabIdBySlug.get('deals')! });
      }
      if (links.length) {
        await prisma.variantTab.createMany({ data: links, skipDuplicates: true });
      }

      seeded.push({
        id: service.id,
        key: svc.key,
        categoryId,
        categorySlug: slug,
        price: svc.price,
        rating: svc.rating,
        isPopular: svc.isPopular ?? false,
        badgeSlug: svc.badgeSlug,
        variants: createdVariants,
      });
    }

    // One package per category: bundle the first 3 variants of the first service
    // that has at least 3 variants (same-service constraint).
    const bundleSource = seeded
      .filter((s) => s.categorySlug === slug)
      .find((s) => s.variants.length >= 3);
    if (bundleSource) {
      const items = bundleSource.variants.slice(0, 3);
      const variantRows = await prisma.serviceVariant.findMany({
        where: { id: { in: items.map((i) => i.id) } },
        select: { id: true, price: true },
      });
      const sum = variantRows.reduce((acc, r) => acc + Number(r.price), 0);
      const bundlePrice = Math.round(sum * 0.85);
      await prisma.package.create({
        data: {
          serviceId: bundleSource.id,
          name: `${SERVICES_BY_CATEGORY_SLUG[slug].find((x) => x.key === bundleSource.key)!.name} Care Bundle`,
          description: 'Best-value bundle combining our most-requested services.',
          price: bundlePrice,
          originalPrice: sum,
          displayOrder: 0,
          items: {
            create: items.map((it, idx) => ({
              serviceVariantId: it.id,
              quantity: 1,
              displayOrder: idx,
            })),
          },
        },
      });
      packageCount++;
    }
  }

  console.log(`  Services: ${seeded.length}, Variants: ${variantCount}, Packages: ${packageCount}`);
  return seeded;
}

async function seedPartners() {
  const categories = await prisma.category.findMany({ select: { id: true } });
  const zones = await prisma.zone.findMany({
    where: { active: true },
    select: { id: true, area: { select: { cityId: true } } },
  });
  const zonesByCity = new Map<string, string[]>();
  for (const z of zones) {
    const cityId = z.area.cityId;
    zonesByCity.set(cityId, [...(zonesByCity.get(cityId) ?? []), z.id]);
  }
  const cityIds = [...zonesByCity.keys()];

  const partners: { id: string; categoryId: string; zoneIds: string[] }[] = [];
  for (let i = 0; i < 20; i++) {
    const categoryId = categories[i % categories.length].id;
    const cityId = cityIds[i % cityIds.length];
    const cityZones = zonesByCity.get(cityId) ?? [];
    const count = Math.min(cityZones.length, 1 + (i % 3));
    const start = i % Math.max(1, cityZones.length);
    const zoneIds = Array.from({ length: count }, (_, k) =>
      cityZones[(start + k) % cityZones.length],
    ).filter((v, idx, arr) => arr.indexOf(v) === idx);

    const partner = await prisma.partner.create({
      data: {
        name: fullName(i),
        phone: phone(1000 + i),
        email: `partner${i}@taskbox.pk`,
        categoryId,
        cityId,
        rating: Math.round((3.5 + (i % 14) / 10) * 100) / 100,
        totalJobs: 5 + ((i * 7) % 120),
        availability: i % 5 !== 0,
        verified: true,
      },
      select: { id: true },
    });
    if (zoneIds.length) {
      await prisma.partnerZone.createMany({
        data: zoneIds.map((zoneId) => ({ partnerId: partner.id, zoneId })),
        skipDuplicates: true,
      });
    }
    partners.push({ id: partner.id, categoryId, zoneIds });
  }
  console.log(`  Partners: ${partners.length}`);
  return partners;
}

type SeededAddress = { id: string; zoneId: string };
type SeededCustomer = { id: string; addresses: SeededAddress[] };

async function seedCustomers(): Promise<SeededCustomer[]> {
  const zones = await prisma.zone.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      area: {
        select: { name: true, cityId: true, city: { select: { province: true } } },
      },
    },
  });

  const customers: SeededCustomer[] = [];
  for (let i = 0; i < 15; i++) {
    const zone = zones[i % zones.length];
    const customer = await prisma.customer.create({
      data: {
        name: fullName(i + 3),
        phone: phone(2000 + i),
        email: `customer${i}@example.pk`,
        cityId: zone.area.cityId,
        addresses: {
          create: {
            label: AddressLabel.HOME,
            fullAddress: `House ${10 + i}, ${zone.area.name} ${zone.name}`,
            area: zone.area.name,
            cityId: zone.area.cityId,
            province: zone.area.city.province,
            assignedZoneId: zone.id,
            isDefault: true,
          },
        },
      },
      select: { id: true, addresses: { select: { id: true, assignedZoneId: true } } },
    });
    customers.push({
      id: customer.id,
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        zoneId: a.assignedZoneId ?? zone.id,
      })),
    });
  }
  console.log(`  Customers: ${customers.length}`);
  return customers;
}

async function seedBookings(
  services: SeededService[],
  partners: { id: string; categoryId: string; zoneIds: string[] }[],
  customers: SeededCustomer[],
) {
  const partnersByZone = new Map<string, string[]>();
  for (const p of partners) {
    for (const z of p.zoneIds) {
      partnersByZone.set(z, [...(partnersByZone.get(z) ?? []), p.id]);
    }
  }

  const distribution: BookingStatus[] = [
    ...Array<BookingStatus>(10).fill(BookingStatus.PENDING),
    ...Array<BookingStatus>(8).fill(BookingStatus.AUTO_ASSIGNED),
    ...Array<BookingStatus>(10).fill(BookingStatus.CONFIRMED),
    ...Array<BookingStatus>(8).fill(BookingStatus.IN_PROGRESS),
    ...Array<BookingStatus>(16).fill(BookingStatus.COMPLETED),
    ...Array<BookingStatus>(8).fill(BookingStatus.CANCELLED),
  ];

  const times = ['09:00 AM', '11:30 AM', '01:00 PM', '03:30 PM', '05:00 PM'];
  // Only services with at least one variant can be booked (XOR requires a variant).
  const bookable = services.filter((s) => s.variants.length > 0);
  let count = 0;

  for (let i = 0; i < distribution.length; i++) {
    const status = distribution[i];
    const customer = customers[i % customers.length];
    const address = customer.addresses[0];
    const service = bookable[i % bookable.length];
    const variant = service.variants[i % service.variants.length];

    const createdAt = i % 5 < 3 ? daysAgo(i % 7) : daysAgo(7 + (i % 7));
    const scheduledDate = new Date(createdAt);
    scheduledDate.setDate(scheduledDate.getDate() + (i % 3));

    const needsPartner = status !== BookingStatus.PENDING;
    const zoneCandidates = partnersByZone.get(address.zoneId) ?? [];
    const partnerId = needsPartner
      ? zoneCandidates[i % Math.max(1, zoneCandidates.length)] ??
        partners[i % partners.length].id
      : null;

    const paymentStatus =
      status === BookingStatus.COMPLETED
        ? PaymentStatus.PAID
        : status === BookingStatus.CANCELLED && i % 2 === 0
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PENDING;

    await prisma.booking.create({
      data: {
        customerId: customer.id,
        customerAddressId: address.id,
        serviceId: service.id,
        serviceVariantId: variant.id,
        status,
        scheduledDate,
        scheduledTime: times[i % times.length],
        amount: service.price + (i % 5) * 100,
        autoAssigned: status === BookingStatus.AUTO_ASSIGNED,
        assignedBy: partnerId
          ? status === BookingStatus.AUTO_ASSIGNED
            ? AssignedBy.SYSTEM
            : AssignedBy.ADMIN
          : null,
        assignedAt: partnerId ? createdAt : null,
        partnerId,
        paymentStatus,
        createdAt,
      },
    });
    count++;
  }
  console.log(`  Bookings: ${count}`);
}

async function createHomeFeatures(services: SeededService[]) {
  // Ensure the two starter sections exist (idempotent — the promotion migration
  // already seeded them with these stable ids; we upsert by slug for safety).
  const topSection = await prisma.homeSection.upsert({
    where: { slug: 'top-services' },
    update: { name: 'Top Services', displayOrder: 0 },
    create: { id: 'hs_top_services', slug: 'top-services', name: 'Top Services', displayOrder: 0 },
  });
  const recommendedSection = await prisma.homeSection.upsert({
    where: { slug: 'recommended' },
    update: { name: 'Recommended for you', displayOrder: 1 },
    create: { id: 'hs_recommended', slug: 'recommended', name: 'Recommended for you', displayOrder: 1 },
  });

  const topRated = [...services].sort((a, b) => b.rating - a.rating).slice(0, 3);
  const newOne = services.find((s) => s.badgeSlug === 'new');
  const recommended = [
    ...(newOne ? [newOne] : []),
    ...services.filter((s) => s.isPopular && s.id !== newOne?.id),
  ]
    .filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx)
    .slice(0, 3);

  let n = 0;
  for (let i = 0; i < topRated.length; i++) {
    await prisma.homeFeature.create({
      data: { serviceId: topRated[i].id, sectionId: topSection.id, displayOrder: i },
    });
    n++;
  }
  for (let i = 0; i < recommended.length; i++) {
    await prisma.homeFeature.create({
      data: { serviceId: recommended[i].id, sectionId: recommendedSection.id, displayOrder: i },
    });
    n++;
  }
  console.log(`  HomeFeatures: ${n} across 2 sections`);
}

async function main() {
  console.log('Seeding TaskBox database…');
  await seedUsers();
  await seedCities();
  await seedAreasAndZones();
  const tabIds = await seedTabs();
  const badgeIds = await seedBadges();
  const categoryIds = await seedCategories();
  await resetSeedData();
  const services = await seedServicesVariantsPackages(categoryIds, tabIds, badgeIds);
  await createHomeFeatures(services);
  const partners = await seedPartners();
  const customers = await seedCustomers();
  await seedBookings(services, partners, customers);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
