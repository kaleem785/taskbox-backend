import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PromoDiscountType, PromoStatus } from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePromoDto,
  UpdatePromoDto,
  ValidatePromoDto,
} from './dto/promo.dto';

@Injectable()
export class PromosService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async get(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    return promo;
  }

  create(input: CreatePromoDto) {
    return this.prisma.promoCode.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        validFrom: new Date(input.validFrom),
        validUntil: new Date(input.validUntil),
      },
    });
  }

  update(id: string, input: UpdatePromoDto) {
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...input,
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        ...(input.validFrom ? { validFrom: new Date(input.validFrom) } : {}),
        ...(input.validUntil ? { validUntil: new Date(input.validUntil) } : {}),
      },
    });
  }

  async deactivate(id: string) {
    return this.prisma.promoCode.update({
      where: { id },
      data: { status: PromoStatus.INACTIVE },
    });
  }

  async validate(input: ValidatePromoDto) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (!promo) throw new UnprocessableEntityException('Code does not exist');
    if (promo.status !== PromoStatus.ACTIVE) {
      throw new UnprocessableEntityException(`Code is ${promo.status}`);
    }
    const now = new Date();
    if (now < promo.validFrom) {
      throw new UnprocessableEntityException('Code not yet active');
    }
    if (now > promo.validUntil) {
      throw new UnprocessableEntityException('Code expired');
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      throw new UnprocessableEntityException('Code usage limit reached');
    }
    if (promo.minOrderValue && input.orderAmount < Number(promo.minOrderValue)) {
      throw new UnprocessableEntityException(
        `Minimum order Rs ${promo.minOrderValue.toString()}`,
      );
    }
    if (promo.categoryId && promo.categoryId !== input.categoryId) {
      throw new UnprocessableEntityException(
        'Code does not apply to this service category',
      );
    }

    const value = Number(promo.discountValue);
    const discount =
      promo.discountType === PromoDiscountType.PERCENTAGE
        ? (input.orderAmount * value) / 100
        : Math.min(value, input.orderAmount);

    return {
      promoId: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: value,
      discount: Number(discount.toFixed(2)),
      finalAmount: Number((input.orderAmount - discount).toFixed(2)),
    };
  }
}
