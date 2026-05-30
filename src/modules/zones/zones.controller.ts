import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '../../prisma/client';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone.dto';
import { ZonesService } from './zones.service';

@ApiTags('zones')
@Controller()
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  // ── Cities ────────────────────────────────────────────────────────────────

  @Public()
  @Get('cities')
  listCities(
    @Query('province') province?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.zones.listCities({ province, activeOnly: activeOnly !== 'false' });
  }

  @Public()
  @Get('cities/:id')
  getCity(@Param('id') id: string) {
    return this.zones.getCity(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.zones.createCity(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.zones.updateCity(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('cities/:id')
  deactivateCity(@Param('id') id: string) {
    return this.zones.deactivateCity(id);
  }

  // ── Areas ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('areas')
  listAreas(
    @Query('cityId') cityId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.zones.listAreas({ cityId, activeOnly: activeOnly !== 'false' });
  }

  @Public()
  @Get('areas/:id')
  getArea(@Param('id') id: string) {
    return this.zones.getArea(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('areas')
  createArea(@Body() dto: CreateAreaDto) {
    return this.zones.createArea(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('areas/:id')
  updateArea(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.zones.updateArea(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('areas/:id')
  deactivateArea(@Param('id') id: string) {
    return this.zones.deactivateArea(id);
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  @Public()
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({
    name: 'areaIds',
    required: false,
    description: 'Comma-separated area IDs; returns zones for all of them in one request',
  })
  @ApiQuery({ name: 'activeOnly', required: false })
  @Get('zones')
  listZones(
    @Query('areaId') areaId?: string,
    @Query('areaIds') areaIds?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const parsedAreaIds = areaIds
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.zones.listZones({
      areaId,
      areaIds: parsedAreaIds,
      activeOnly: activeOnly !== 'false',
    });
  }

  @Public()
  @Get('zones/:id')
  getZone(@Param('id') id: string) {
    return this.zones.getZone(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('zones')
  createZone(@Body() dto: CreateZoneDto) {
    return this.zones.createZone(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zones.updateZone(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('zones/:id')
  deactivateZone(@Param('id') id: string) {
    return this.zones.deactivateZone(id);
  }
}
