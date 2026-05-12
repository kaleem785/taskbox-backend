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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import {
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
} from './dto/sub-category.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List categories (public)' })
  listCategories(@Query('activeOnly') activeOnly?: string) {
    return this.catalog.listCategories({ activeOnly: activeOnly !== 'false' });
  }

  @Public()
  @Get('categories/:id')
  getCategory(@Param('id') id: string) {
    return this.catalog.getCategory(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('categories')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('categories/:id')
  @ApiOperation({ summary: 'Deactivate a category (soft delete)' })
  deactivateCategory(@Param('id') id: string) {
    return this.catalog.deactivateCategory(id);
  }

  // ── Sub-categories ────────────────────────────────────────────────────────

  @Public()
  @Get('sub-categories')
  listSubCategories(
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.catalog.listSubCategories({
      categoryId,
      activeOnly: activeOnly !== 'false',
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('sub-categories')
  createSubCategory(@Body() dto: CreateSubCategoryDto) {
    return this.catalog.createSubCategory(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('sub-categories/:id')
  updateSubCategory(@Param('id') id: string, @Body() dto: UpdateSubCategoryDto) {
    return this.catalog.updateSubCategory(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('sub-categories/:id')
  deactivateSubCategory(@Param('id') id: string) {
    return this.catalog.deactivateSubCategory(id);
  }

  // ── Services ──────────────────────────────────────────────────────────────

  @Public()
  @Get('services')
  listServices(
    @Query('categoryId') categoryId?: string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('cityId') cityId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.catalog.listServices({
      categoryId,
      subCategoryId,
      cityId,
      activeOnly: activeOnly !== 'false',
    });
  }

  @Public()
  @Get('services/:id')
  getService(@Param('id') id: string) {
    return this.catalog.getService(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('services')
  createService(@Body() dto: CreateServiceDto) {
    return this.catalog.createService(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.catalog.updateService(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('services/:id')
  deactivateService(@Param('id') id: string) {
    return this.catalog.deactivateService(id);
  }
}
