import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntityType,
  Category,
  Prisma,
} from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CatalogActor,
  logCatalogActivity,
} from './catalog-activity-log.helper';
import { CreateBadgeDto, UpdateBadgeDto } from './dto/badge.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  CreateHomeFeatureDto,
  UpdateHomeFeatureDto,
} from './dto/home-feature.dto';
import {
  CreateHomeSectionDto,
  UpdateHomeSectionDto,
} from './dto/home-section.dto';
import {
  AddPackageItemDto,
  CreatePackageDto,
  UpdatePackageDto,
  UpdatePackageItemDto,
} from './dto/package.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import {
  CreateServiceVariantDto,
  UpdateServiceVariantDto,
} from './dto/service-variant.dto';
import { CreateTabDto, UpdateTabDto } from './dto/tab.dto';

/** Resolve "active + within optional validity window" for Tabs / Badges. */
function windowWhere(now: Date) {
  return {
    active: true,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    ],
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  listCategories(opts: { activeOnly?: boolean } = {}): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: opts.activeOnly ? { active: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  createCategory(input: CreateCategoryDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.category.create({ data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.CATEGORY,
        entityId: created.id,
        event: 'CREATED',
        actor,
        detail: created.name,
      });
      return created;
    });
  }

  updateCategory(id: string, input: UpdateCategoryDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.CATEGORY,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return updated;
    });
  }

  /** Soft-delete: flip active=false. Hard delete is intentionally disallowed. */
  deactivateCategory(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: { active: false },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.CATEGORY,
        entityId: id,
        event: 'SOFT_DELETED',
        actor,
      });
      return updated;
    });
  }

  // ── Services ──────────────────────────────────────────────────────────────

  private static readonly SERVICE_INCLUDE = {
    cities: { select: { cityId: true } },
    badge: true,
    _count: { select: { variants: true, packages: true } },
  } satisfies Prisma.ServiceInclude;

  listServices(
    opts: {
      categoryId?: string;
      cityId?: string;
      activeOnly?: boolean;
    } = {},
  ) {
    return this.prisma.service.findMany({
      where: {
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.cityId ? { cities: { some: { cityId: opts.cityId } } } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [
        { isPopular: 'desc' },
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
      include: CatalogService.SERVICE_INCLUDE,
    });
  }

  async getService(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: CatalogService.SERVICE_INCLUDE,
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  createService(input: CreateServiceDto, actor?: CatalogActor) {
    const { cityIds, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          ...data,
          cities: cityIds?.length
            ? { create: cityIds.map((cityId) => ({ cityId })) }
            : undefined,
        },
        include: CatalogService.SERVICE_INCLUDE,
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE,
        entityId: created.id,
        event: 'CREATED',
        actor,
        detail: created.name,
      });
      return created;
    });
  }

  async updateService(id: string, input: UpdateServiceDto, actor?: CatalogActor) {
    const { cityIds, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({ where: { id }, data });
      if (cityIds) {
        await tx.serviceCity.deleteMany({ where: { serviceId: id } });
        if (cityIds.length) {
          await tx.serviceCity.createMany({
            data: cityIds.map((cityId) => ({ serviceId: id, cityId })),
            skipDuplicates: true,
          });
        }
      }
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return tx.service.findUniqueOrThrow({
        where: { id: updated.id },
        include: CatalogService.SERVICE_INCLUDE,
      });
    });
  }

  deactivateService(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: { active: false },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE,
        entityId: id,
        event: 'SOFT_DELETED',
        actor,
      });
      return updated;
    });
  }

  // ── Service variants ────────────────────────────────────────────────────────

  private static readonly VARIANT_INCLUDE = {
    tabs: { include: { tab: true } },
  } satisfies Prisma.ServiceVariantInclude;

  private shapeVariant(
    v: Prisma.ServiceVariantGetPayload<{
      include: typeof CatalogService.VARIANT_INCLUDE;
    }>,
  ) {
    const { tabs, ...rest } = v;
    return {
      ...rest,
      tabs: tabs.map((vt) => ({
        id: vt.tab.id,
        slug: vt.tab.slug,
        name: vt.tab.name,
      })),
    };
  }

  async listVariants(
    serviceId: string,
    opts: { activeOnly?: boolean; tabSlug?: string } = {},
  ) {
    let tabId: string | undefined;
    if (opts.tabSlug) {
      const tab = await this.prisma.tab.findUnique({
        where: { slug: opts.tabSlug },
        select: { id: true },
      });
      if (!tab) return [];
      tabId = tab.id;
    }
    const variants = await this.prisma.serviceVariant.findMany({
      where: {
        serviceId,
        ...(opts.activeOnly ? { active: true } : {}),
        ...(tabId ? { tabs: { some: { tabId } } } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: CatalogService.VARIANT_INCLUDE,
    });
    return variants.map((v) => this.shapeVariant(v));
  }

  async getVariant(id: string) {
    const variant = await this.prisma.serviceVariant.findUnique({
      where: { id },
      include: CatalogService.VARIANT_INCLUDE,
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return this.shapeVariant(variant);
  }

  async createVariant(
    serviceId: string,
    input: CreateServiceVariantDto,
    actor?: CatalogActor,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    const { tabIds, ...data } = input;
    const created = await this.prisma.$transaction(async (tx) => {
      const v = await tx.serviceVariant.create({
        data: { ...data, serviceId },
      });
      if (tabIds?.length) {
        await tx.variantTab.createMany({
          data: tabIds.map((tabId) => ({ variantId: v.id, tabId })),
          skipDuplicates: true,
        });
      }
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE_VARIANT,
        entityId: v.id,
        event: 'CREATED',
        actor,
        detail: v.name,
      });
      return tx.serviceVariant.findUniqueOrThrow({
        where: { id: v.id },
        include: CatalogService.VARIANT_INCLUDE,
      });
    });
    return this.shapeVariant(created);
  }

  async updateVariant(
    id: string,
    input: UpdateServiceVariantDto,
    actor?: CatalogActor,
  ) {
    // tabIds is ignored here — tab membership is set via setVariantTabs.
    const { tabIds: _ignored, ...data } = input;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.serviceVariant.update({ where: { id }, data });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE_VARIANT,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return tx.serviceVariant.findUniqueOrThrow({
        where: { id },
        include: CatalogService.VARIANT_INCLUDE,
      });
    });
    return this.shapeVariant(updated);
  }

  deactivateVariant(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceVariant.update({
        where: { id },
        data: { active: false },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE_VARIANT,
        entityId: id,
        event: 'SOFT_DELETED',
        actor,
      });
      return updated;
    });
  }

  /** Atomically replace a variant's full tab set. */
  async setVariantTabs(
    variantId: string,
    tabIds: string[],
    actor?: CatalogActor,
  ) {
    const variant = await this.prisma.serviceVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.variantTab.deleteMany({ where: { variantId } });
      if (tabIds.length) {
        await tx.variantTab.createMany({
          data: tabIds.map((tabId) => ({ variantId, tabId })),
          skipDuplicates: true,
        });
      }
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.SERVICE_VARIANT,
        entityId: variantId,
        event: 'TABS_SET',
        actor,
        meta: { tabIds },
      });
      return tx.serviceVariant.findUniqueOrThrow({
        where: { id: variantId },
        include: CatalogService.VARIANT_INCLUDE,
      });
    });
    return this.shapeVariant(result);
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  listTabs(opts: { activeOnly?: boolean; inWindow?: boolean } = {}) {
    const now = new Date();
    const where: Prisma.TabWhereInput = opts.inWindow
      ? windowWhere(now)
      : opts.activeOnly
        ? { active: true }
        : {};
    return this.prisma.tab.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { variants: true } } },
    });
  }

  async getTab(id: string) {
    const tab = await this.prisma.tab.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!tab) throw new NotFoundException('Tab not found');
    return tab;
  }

  createTab(input: CreateTabDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.tab.create({ data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.TAB,
        entityId: created.id,
        event: 'CREATED',
        actor,
        detail: created.name,
      });
      return created;
    });
  }

  updateTab(id: string, input: UpdateTabDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tab.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.TAB,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return updated;
    });
  }

  /** Hard-delete with cascade clearing VariantTab rows; variants survive. */
  deleteTab(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.tab.delete({ where: { id } });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.TAB,
        entityId: id,
        event: 'HARD_DELETED',
        actor,
        detail: deleted.name,
      });
      return { id };
    });
  }

  reorderTabs(orderedIds: string[], actor?: CatalogActor) {
    return this.reorderByDisplayOrder('tab', orderedIds, actor, {
      entityType: ActivityEntityType.TAB,
    });
  }

  // ── Badges ───────────────────────────────────────────────────────────────

  listBadges(opts: { activeOnly?: boolean; inWindow?: boolean } = {}) {
    const now = new Date();
    const where: Prisma.BadgeWhereInput = opts.inWindow
      ? windowWhere(now)
      : opts.activeOnly
        ? { active: true }
        : {};
    return this.prisma.badge.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { services: true } } },
    });
  }

  async getBadge(id: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });
    if (!badge) throw new NotFoundException('Badge not found');
    return badge;
  }

  createBadge(input: CreateBadgeDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.badge.create({ data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.BADGE,
        entityId: created.id,
        event: 'CREATED',
        actor,
        detail: created.name,
      });
      return created;
    });
  }

  updateBadge(id: string, input: UpdateBadgeDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.badge.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.BADGE,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return updated;
    });
  }

  /** Hard-delete; Service.badgeId is set null via FK (onDelete: SetNull). */
  deleteBadge(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.badge.delete({ where: { id } });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.BADGE,
        entityId: id,
        event: 'HARD_DELETED',
        actor,
        detail: deleted.name,
      });
      return { id };
    });
  }

  reorderBadges(orderedIds: string[], actor?: CatalogActor) {
    return this.reorderByDisplayOrder('badge', orderedIds, actor, {
      entityType: ActivityEntityType.BADGE,
    });
  }

  /** Shared atomic displayOrder rewrite for Tab/Badge. */
  private async reorderByDisplayOrder(
    model: 'tab' | 'badge' | 'homeSection',
    orderedIds: string[],
    actor: CatalogActor | undefined,
    log: { entityType: ActivityEntityType },
  ) {
    const existing =
      model === 'tab'
        ? await this.prisma.tab.findMany({ select: { id: true } })
        : model === 'badge'
          ? await this.prisma.badge.findMany({ select: { id: true } })
          : await this.prisma.homeSection.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((r) => r.id));
    if (
      orderedIds.length !== existingIds.size ||
      orderedIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestException(
        `orderedIds must contain exactly the existing ${model} ids`,
      );
    }
    const updates = orderedIds.map((id, i) => {
      const data = { displayOrder: i };
      switch (model) {
        case 'tab':
          return this.prisma.tab.update({ where: { id }, data });
        case 'badge':
          return this.prisma.badge.update({ where: { id }, data });
        case 'homeSection':
          return this.prisma.homeSection.update({ where: { id }, data });
      }
    });
    await this.prisma.$transaction([
      ...updates,
      this.prisma.activityLog.create({
        data: {
          entityType: log.entityType,
          entityId: 'reorder',
          event: 'REORDERED',
          actorUserId: actor?.userId,
          actorName: actor?.name,
          meta: { orderedIds },
        },
      }),
    ]);
    return { orderedIds };
  }

  // ── Packages ───────────────────────────────────────────────────────────────

  private static readonly PACKAGE_INCLUDE = {
    items: {
      orderBy: { displayOrder: 'asc' },
      include: { variant: true },
    },
  } satisfies Prisma.PackageInclude;

  listPackages(serviceId: string, opts: { activeOnly?: boolean } = {}) {
    return this.prisma.package.findMany({
      where: {
        serviceId,
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: CatalogService.PACKAGE_INCLUDE,
    });
  }

  async getPackage(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: CatalogService.PACKAGE_INCLUDE,
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  /** Validate that a variant exists and belongs to the given service. */
  private async assertVariantInService(variantId: string, serviceId: string) {
    const variant = await this.prisma.serviceVariant.findUnique({
      where: { id: variantId },
      select: { id: true, serviceId: true },
    });
    if (!variant || variant.serviceId !== serviceId) {
      throw new BadRequestException(
        `Variant ${variantId} does not belong to service ${serviceId}`,
      );
    }
  }

  async createPackage(
    serviceId: string,
    input: CreatePackageDto,
    actor?: CatalogActor,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const { items, ...data } = input;
    if (input.originalPrice != null && input.originalPrice < input.price) {
      throw new BadRequestException('originalPrice must be >= price');
    }
    // Enforce that all items belong to this service. App-level only — the
    // same-service constraint is no longer mirrored by a DB composite FK.
    const uniqueVariantIds = [...new Set(items.map((i) => i.variantId))];
    if (uniqueVariantIds.length !== items.length) {
      throw new BadRequestException('Duplicate variant in package items');
    }
    await Promise.all(
      uniqueVariantIds.map((vid) => this.assertVariantInService(vid, serviceId)),
    );

    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({ data: { ...data, serviceId } });
      await tx.packageItem.createMany({
        data: items.map((it, i) => ({
          packageId: pkg.id,
          serviceVariantId: it.variantId,
          quantity: it.quantity ?? 1,
          displayOrder: it.displayOrder ?? i,
        })),
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: pkg.id,
        event: 'CREATED',
        actor,
        detail: pkg.name,
      });
      return tx.package.findUniqueOrThrow({
        where: { id: pkg.id },
        include: CatalogService.PACKAGE_INCLUDE,
      });
    });
  }

  async updatePackage(id: string, input: UpdatePackageDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      await tx.package.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return tx.package.findUniqueOrThrow({
        where: { id },
        include: CatalogService.PACKAGE_INCLUDE,
      });
    });
  }

  deactivatePackage(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.package.update({
        where: { id },
        data: { active: false },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: id,
        event: 'SOFT_DELETED',
        actor,
      });
      return updated;
    });
  }

  async addPackageItem(
    packageId: string,
    input: AddPackageItemDto,
    actor?: CatalogActor,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, serviceId: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    await this.assertVariantInService(input.variantId, pkg.serviceId);
    return this.prisma.$transaction(async (tx) => {
      await tx.packageItem.create({
        data: {
          packageId,
          serviceVariantId: input.variantId,
          quantity: input.quantity ?? 1,
          displayOrder: input.displayOrder ?? 0,
        },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: packageId,
        event: 'ITEMS_CHANGED',
        actor,
        meta: { added: input.variantId },
      });
      return tx.package.findUniqueOrThrow({
        where: { id: packageId },
        include: CatalogService.PACKAGE_INCLUDE,
      });
    });
  }

  async updatePackageItem(
    packageId: string,
    variantId: string,
    input: UpdatePackageItemDto,
    actor?: CatalogActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.packageItem.update({
        where: {
          packageId_serviceVariantId: {
            packageId,
            serviceVariantId: variantId,
          },
        },
        data: input,
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: packageId,
        event: 'ITEMS_CHANGED',
        actor,
        meta: { updated: variantId },
      });
      return tx.package.findUniqueOrThrow({
        where: { id: packageId },
        include: CatalogService.PACKAGE_INCLUDE,
      });
    });
  }

  async removePackageItem(
    packageId: string,
    variantId: string,
    actor?: CatalogActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.packageItem.delete({
        where: {
          packageId_serviceVariantId: {
            packageId,
            serviceVariantId: variantId,
          },
        },
      });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.PACKAGE,
        entityId: packageId,
        event: 'ITEMS_CHANGED',
        actor,
        meta: { removed: variantId },
      });
      return tx.package.findUniqueOrThrow({
        where: { id: packageId },
        include: CatalogService.PACKAGE_INCLUDE,
      });
    });
  }

  // ── Home sections (admin-curated rows) ───────────────────────────────────

  listHomeSections(opts: { activeOnly?: boolean; inWindow?: boolean } = {}) {
    const now = new Date();
    const where: Prisma.HomeSectionWhereInput = opts.inWindow
      ? windowWhere(now)
      : opts.activeOnly
        ? { active: true }
        : {};
    return this.prisma.homeSection.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { features: true } } },
    });
  }

  async getHomeSection(id: string) {
    const section = await this.prisma.homeSection.findUnique({
      where: { id },
      include: { _count: { select: { features: true } } },
    });
    if (!section) throw new NotFoundException('Home section not found');
    return section;
  }

  createHomeSection(input: CreateHomeSectionDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.homeSection.create({ data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_SECTION,
        entityId: created.id,
        event: 'CREATED',
        actor,
        detail: created.name,
      });
      return created;
    });
  }

  updateHomeSection(id: string, input: UpdateHomeSectionDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.homeSection.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_SECTION,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return updated;
    });
  }

  /** Hard-delete with cascade clearing the section's HomeFeature rows. */
  deleteHomeSection(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.homeSection.delete({ where: { id } });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_SECTION,
        entityId: id,
        event: 'HARD_DELETED',
        actor,
        detail: deleted.name,
      });
      return { id };
    });
  }

  reorderHomeSections(orderedIds: string[], actor?: CatalogActor) {
    return this.reorderByDisplayOrder('homeSection', orderedIds, actor, {
      entityType: ActivityEntityType.HOME_SECTION,
    });
  }

  // ── Home features (placements within a section) ──────────────────────────

  /**
   * Customer-facing: ordered array of sections (each in-window) with their
   * in-window, active features resolved to Service[]. One round-trip for the
   * customer home screen.
   */
  async getHomeLayout() {
    const now = new Date();
    const sections = await this.prisma.homeSection.findMany({
      where: windowWhere(now),
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        features: {
          where: windowWhere(now),
          orderBy: { displayOrder: 'asc' },
          include: { service: { include: CatalogService.SERVICE_INCLUDE } },
        },
      },
    });
    return sections.map((s) => ({
      section: {
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
      },
      services: s.features.map((f) => f.service),
    }));
  }

  listHomeFeatures(sectionId?: string) {
    return this.prisma.homeFeature.findMany({
      where: sectionId ? { sectionId } : {},
      orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }],
      include: {
        service: { select: { id: true, name: true, imageUrl: true } },
        section: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  async createHomeFeature(input: CreateHomeFeatureDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.homeFeature.create({ data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_FEATURE,
        entityId: created.id,
        event: 'CREATED',
        actor,
        meta: { sectionId: input.sectionId, serviceId: input.serviceId },
      });
      return created;
    });
  }

  updateHomeFeature(id: string, input: UpdateHomeFeatureDto, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.homeFeature.update({ where: { id }, data: input });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_FEATURE,
        entityId: id,
        event: 'UPDATED',
        actor,
      });
      return updated;
    });
  }

  deleteHomeFeature(id: string, actor?: CatalogActor) {
    return this.prisma.$transaction(async (tx) => {
      await tx.homeFeature.delete({ where: { id } });
      await logCatalogActivity(tx, {
        entityType: ActivityEntityType.HOME_FEATURE,
        entityId: id,
        event: 'HARD_DELETED',
        actor,
      });
      return { id };
    });
  }

  async reorderHomeFeatures(
    sectionId: string,
    orderedIds: string[],
    actor?: CatalogActor,
  ) {
    const existing = await this.prisma.homeFeature.findMany({
      where: { sectionId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));
    if (
      orderedIds.length !== existingIds.size ||
      orderedIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestException(
        'orderedIds must contain exactly the section feature ids',
      );
    }
    await this.prisma.$transaction([
      ...orderedIds.map((id, i) =>
        this.prisma.homeFeature.update({
          where: { id },
          data: { displayOrder: i },
        }),
      ),
      this.prisma.activityLog.create({
        data: {
          entityType: ActivityEntityType.HOME_FEATURE,
          entityId: 'reorder',
          event: 'REORDERED',
          actorUserId: actor?.userId,
          actorName: actor?.name,
          meta: { sectionId, orderedIds },
        },
      }),
    ]);
    return { sectionId, orderedIds };
  }
}
