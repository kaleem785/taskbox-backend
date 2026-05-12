import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer, CustomerAddress, CustomerStatus, Prisma } from '@prisma/client';

import {
  buildPaginatedMeta,
  Paginated,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerDto,
  CustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    cityId?: string;
    status?: CustomerStatus;
  }): Promise<Paginated<Customer & { _count: { addresses: number } }>> {
    const { page, limit, search, cityId, status } = params;
    const where: Prisma.CustomerWhereInput = {
      ...(cityId ? { cityId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: search } },
              { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { addresses: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data: items, meta: buildPaginatedMeta(page, limit, total) };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: {
            assignedZone: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
          },
        },
        city: { select: { id: true, name: true, province: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(input: CreateCustomerDto): Promise<Customer> {
    return this.prisma.customer.create({ data: input });
  }

  update(id: string, input: UpdateCustomerDto): Promise<Customer> {
    const { gpsLat, gpsLng, ...rest } = input;
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...rest,
        ...(gpsLat !== undefined && gpsLng !== undefined
          ? { gpsLat, gpsLng, gpsUpdatedAt: new Date() }
          : {}),
      },
    });
  }

  // ── Addresses ─────────────────────────────────────────────────────────────

  async addAddress(customerId: string, input: CustomerAddressDto): Promise<CustomerAddress> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.create({ data: { customerId, ...input } });
    });
  }

  async updateAddress(
    addressId: string,
    input: UpdateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        const current = await tx.customerAddress.findUnique({ where: { id: addressId } });
        if (!current) throw new NotFoundException('Address not found');
        await tx.customerAddress.updateMany({
          where: { customerId: current.customerId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.update({ where: { id: addressId }, data: input });
    });
  }

  async removeAddress(addressId: string): Promise<void> {
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
  }

  assignZone(addressId: string, zoneId: string): Promise<CustomerAddress> {
    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: { assignedZoneId: zoneId },
    });
  }
}
