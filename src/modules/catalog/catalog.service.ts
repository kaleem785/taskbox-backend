import { Injectable, NotFoundException } from '@nestjs/common';
import { Category, Service, SubCategory } from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import {
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
} from './dto/sub-category.dto';

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

  createCategory(input: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({ data: input });
  }

  updateCategory(id: string, input: UpdateCategoryDto): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data: input });
  }

  /** Soft-delete: flip active=false. Hard delete is intentionally disallowed. */
  deactivateCategory(id: string): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data: { active: false } });
  }

  // ── Sub-categories ────────────────────────────────────────────────────────

  listSubCategories(opts: { categoryId?: string; activeOnly?: boolean } = {}) {
    return this.prisma.subCategory.findMany({
      where: {
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getSubCategory(id: string): Promise<SubCategory> {
    const sub = await this.prisma.subCategory.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('SubCategory not found');
    return sub;
  }

  createSubCategory(input: CreateSubCategoryDto): Promise<SubCategory> {
    return this.prisma.subCategory.create({ data: input });
  }

  updateSubCategory(id: string, input: UpdateSubCategoryDto): Promise<SubCategory> {
    return this.prisma.subCategory.update({ where: { id }, data: input });
  }

  deactivateSubCategory(id: string): Promise<SubCategory> {
    return this.prisma.subCategory.update({ where: { id }, data: { active: false } });
  }

  // ── Services ──────────────────────────────────────────────────────────────

  listServices(opts: {
    categoryId?: string;
    subCategoryId?: string;
    cityId?: string;
    activeOnly?: boolean;
  } = {}) {
    return this.prisma.service.findMany({
      where: {
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.subCategoryId ? { subCategoryId: opts.subCategoryId } : {}),
        ...(opts.cityId ? { cities: { some: { cityId: opts.cityId } } } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { cities: { select: { cityId: true } } },
    });
  }

  async getService(id: string): Promise<Service & { cities: { cityId: string }[] }> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { cities: { select: { cityId: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  createService(input: CreateServiceDto) {
    const { cityIds, ...data } = input;
    return this.prisma.service.create({
      data: {
        ...data,
        cities: cityIds?.length
          ? { create: cityIds.map((cityId) => ({ cityId })) }
          : undefined,
      },
      include: { cities: { select: { cityId: true } } },
    });
  }

  async updateService(id: string, input: UpdateServiceDto) {
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
      return tx.service.findUniqueOrThrow({
        where: { id: updated.id },
        include: { cities: { select: { cityId: true } } },
      });
    });
  }

  deactivateService(id: string) {
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
