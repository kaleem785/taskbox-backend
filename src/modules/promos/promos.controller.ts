import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreatePromoDto,
  UpdatePromoDto,
  ValidatePromoDto,
} from './dto/promo.dto';
import { PromosService } from './promos.service';

@ApiBearerAuth()
@ApiTags('promos')
@Controller('promos')
export class PromosController {
  constructor(private readonly promos: PromosService) {}

  @Public()
  @Post('validate')
  validate(@Body() dto: ValidatePromoDto) {
    return this.promos.validate(dto);
  }

  @Roles(Role.ADMIN)
  @Get()
  list() {
    return this.promos.list();
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.promos.get(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePromoDto) {
    return this.promos.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoDto) {
    return this.promos.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.promos.deactivate(id);
  }
}
