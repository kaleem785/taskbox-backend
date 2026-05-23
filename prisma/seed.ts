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

// ── Demo dataset (services, partners, customers, bookings) ──────────────────
//
// The dashboard's Live Dispatch + Zone Heatmap panels read live booking data,
// so we seed a realistic spread of partners/customers/bookings. This data is
// fully reset on each run so reseeding stays idempotent.

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

// Delete all transactional data (everything that depends on partners/customers/
// services) in FK-safe order so the demo seed can run repeatedly.
async function resetTransactionalData() {
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
  await prisma.serviceCity.deleteMany();
  await prisma.service.deleteMany();
  console.log('  Reset transactional data (services/partners/customers/bookings)');
}

type SeededService = { id: string; categoryId: string; price: number };

async function seedServices(): Promise<SeededService[]> {
  const subs = await prisma.subCategory.findMany({
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });
  const services: SeededService[] = [];
  for (const sub of subs) {
    const min = sub.category.priceRangeMin ?? 800;
    const max = sub.category.priceRangeMax ?? 5000;
    const price = Math.round((min + max) / 2);
    const created = await prisma.service.create({
      data: {
        categoryId: sub.categoryId,
        subCategoryId: sub.id,
        name: sub.name,
        description: sub.description,
        price,
      },
      select: { id: true, categoryId: true },
    });
    services.push({ ...created, price });
  }
  console.log(`  Services: ${services.length}`);
  return services;
}

type SeededPartner = { id: string; categoryId: string; zoneIds: string[] };

async function seedPartners(): Promise<SeededPartner[]> {
  const categories = await prisma.category.findMany({ select: { id: true } });
  // Only cities that actually have zones can host partners.
  const zones = await prisma.zone.findMany({
    where: { active: true },
    select: { id: true, cityId: true },
  });
  const zonesByCity = new Map<string, string[]>();
  for (const z of zones) {
    zonesByCity.set(z.cityId, [...(zonesByCity.get(z.cityId) ?? []), z.id]);
  }
  const cityIds = [...zonesByCity.keys()];

  const partners: SeededPartner[] = [];
  for (let i = 0; i < 20; i++) {
    const categoryId = categories[i % categories.length].id;
    const cityId = cityIds[i % cityIds.length];
    const cityZones = zonesByCity.get(cityId) ?? [];
    // Assign 1–3 zones in the partner's city.
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
        rating: Math.round((3.5 + (i % 14) / 10) * 100) / 100, // 3.5–4.8
        totalJobs: 5 + ((i * 7) % 120),
        availability: i % 5 !== 0, // ~80% available
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
    select: { id: true, name: true, cityId: true, city: { select: { province: true } } },
  });

  const customers: SeededCustomer[] = [];
  for (let i = 0; i < 15; i++) {
    const zone = zones[i % zones.length];
    const customer = await prisma.customer.create({
      data: {
        name: fullName(i + 3),
        phone: phone(2000 + i),
        email: `customer${i}@example.pk`,
        cityId: zone.cityId,
        addresses: {
          create: {
            label: AddressLabel.HOME,
            fullAddress: `House ${10 + i}, ${zone.name}`,
            area: zone.name,
            cityId: zone.cityId,
            province: zone.city.province,
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
  partners: SeededPartner[],
  customers: SeededCustomer[],
) {
  // partnerId candidates per zone, for sensible (zone-matched) assignment.
  const partnersByZone = new Map<string, string[]>();
  for (const p of partners) {
    for (const z of p.zoneIds) {
      partnersByZone.set(z, [...(partnersByZone.get(z) ?? []), p.id]);
    }
  }

  // Status distribution across ~60 bookings (covers every BookingStatus).
  const distribution: BookingStatus[] = [
    ...Array<BookingStatus>(10).fill(BookingStatus.PENDING),
    ...Array<BookingStatus>(8).fill(BookingStatus.AUTO_ASSIGNED),
    ...Array<BookingStatus>(10).fill(BookingStatus.CONFIRMED),
    ...Array<BookingStatus>(8).fill(BookingStatus.IN_PROGRESS),
    ...Array<BookingStatus>(16).fill(BookingStatus.COMPLETED),
    ...Array<BookingStatus>(8).fill(BookingStatus.CANCELLED),
  ];

  const times = ['09:00 AM', '11:30 AM', '01:00 PM', '03:30 PM', '05:00 PM'];
  let count = 0;

  for (let i = 0; i < distribution.length; i++) {
    const status = distribution[i];
    const customer = customers[i % customers.length];
    const address = customer.addresses[0];
    const service = services[i % services.length];

    // Bias ~60% of bookings into the last 7 days so the heatmap trend is positive.
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
        partnerId,
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
        paymentStatus,
        createdAt,
      },
    });
    count++;
  }
  console.log(`  Bookings: ${count}`);
}

async function main() {
  console.log('Seeding TaskBox database…');
  await seedUsers();
  await seedCities();
  await seedZones();
  await seedCatalog();
  await resetTransactionalData();
  const services = await seedServices();
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
