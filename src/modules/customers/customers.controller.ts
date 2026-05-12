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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CustomersService } from './customers.service';
import {
  AssignAddressZoneDto,
  CreateCustomerDto,
  CustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@ApiBearerAuth()
@ApiTags('customers')
@Roles(Role.ADMIN)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  async list(@Query() q: CustomerQueryDto) {
    return this.customers.list({
      page: q.page,
      limit: q.limit,
      search: q.search,
      cityId: q.cityId,
      status: q.status,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Post(':id/addresses')
  addAddress(@Param('id') id: string, @Body() dto: CustomerAddressDto) {
    return this.customers.addAddress(id, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @Param('addressId') addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customers.updateAddress(addressId, dto);
  }

  @Delete('addresses/:addressId')
  removeAddress(@Param('addressId') addressId: string) {
    return this.customers.removeAddress(addressId);
  }

  @Post('addresses/:addressId/assign-zone')
  assignZone(@Param('addressId') addressId: string, @Body() dto: AssignAddressZoneDto) {
    return this.customers.assignZone(addressId, dto.zoneId);
  }
}
