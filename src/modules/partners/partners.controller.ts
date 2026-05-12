import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import {
  AssignZonesDto,
  CreatePartnerDto,
  ToggleAvailabilityDto,
  UpdatePartnerDto,
} from './dto/partner.dto';
import { PartnerQueryDto } from './dto/partner-query.dto';
import { PartnersService } from './partners.service';

@ApiBearerAuth()
@ApiTags('partners')
@Roles(Role.ADMIN)
@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  list(@Query() q: PartnerQueryDto) {
    return this.partners.list({
      page: q.page,
      limit: q.limit,
      search: q.search,
      categoryId: q.categoryId,
      cityId: q.cityId,
      zoneId: q.zoneId,
      verified:
        q.verified === 'true' ? true : q.verified === 'false' ? false : undefined,
      availability:
        q.availability === 'true' ? true : q.availability === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.partners.get(id);
  }

  @Post()
  create(@Body() dto: CreatePartnerDto) {
    return this.partners.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }

  @Patch(':id/availability')
  setAvailability(@Param('id') id: string, @Body() dto: ToggleAvailabilityDto) {
    return this.partners.setAvailability(id, dto.availability);
  }

  @Patch(':id/zones')
  assignZones(@Param('id') id: string, @Body() dto: AssignZonesDto) {
    return this.partners.assignZones(id, dto.zoneIds);
  }
}
