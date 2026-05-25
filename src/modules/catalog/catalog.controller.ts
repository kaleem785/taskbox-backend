import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../prisma/client';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogActor } from './catalog-activity-log.helper';
import { CatalogService } from './catalog.service';
import { CreateBadgeDto, ReorderBadgesDto, UpdateBadgeDto } from './dto/badge.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  CreateHomeFeatureDto,
  ReorderHomeFeaturesDto,
  UpdateHomeFeatureDto,
} from './dto/home-feature.dto';
import {
  CreateHomeSectionDto,
  ReorderHomeSectionsDto,
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
  SetVariantTabsDto,
  UpdateServiceVariantDto,
} from './dto/service-variant.dto';
import { CreateTabDto, ReorderTabsDto, UpdateTabDto } from './dto/tab.dto';

function actorOf(user?: AuthUser): CatalogActor {
  return { userId: user?.id, name: user?.email };
}

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
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createCategory(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateCategory(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('categories/:id')
  @ApiOperation({ summary: 'Deactivate a category (soft delete)' })
  deactivateCategory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deactivateCategory(id, actorOf(user));
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('tabs')
  @ApiOperation({ summary: 'List tabs (public)' })
  listTabs(
    @Query('activeOnly') activeOnly?: string,
    @Query('inWindow') inWindow?: string,
  ) {
    return this.catalog.listTabs({
      activeOnly: activeOnly === 'true',
      inWindow: inWindow === 'true',
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('tabs/reorder')
  reorderTabs(@Body() dto: ReorderTabsDto, @CurrentUser() user: AuthUser) {
    return this.catalog.reorderTabs(dto.orderedIds, actorOf(user));
  }

  @Public()
  @Get('tabs/:id')
  getTab(@Param('id') id: string) {
    return this.catalog.getTab(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('tabs')
  createTab(@Body() dto: CreateTabDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createTab(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('tabs/:id')
  updateTab(
    @Param('id') id: string,
    @Body() dto: UpdateTabDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateTab(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('tabs/:id')
  @ApiOperation({ summary: 'Hard-delete a tab (cascades VariantTab rows)' })
  deleteTab(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteTab(id, actorOf(user));
  }

  // ── Badges ───────────────────────────────────────────────────────────────

  @Public()
  @Get('badges')
  @ApiOperation({ summary: 'List badges (public)' })
  listBadges(
    @Query('activeOnly') activeOnly?: string,
    @Query('inWindow') inWindow?: string,
  ) {
    return this.catalog.listBadges({
      activeOnly: activeOnly === 'true',
      inWindow: inWindow === 'true',
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('badges/reorder')
  reorderBadges(@Body() dto: ReorderBadgesDto, @CurrentUser() user: AuthUser) {
    return this.catalog.reorderBadges(dto.orderedIds, actorOf(user));
  }

  @Public()
  @Get('badges/:id')
  getBadge(@Param('id') id: string) {
    return this.catalog.getBadge(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('badges')
  createBadge(@Body() dto: CreateBadgeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createBadge(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('badges/:id')
  updateBadge(
    @Param('id') id: string,
    @Body() dto: UpdateBadgeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateBadge(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('badges/:id')
  @ApiOperation({ summary: 'Hard-delete a badge (unsets on services)' })
  deleteBadge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteBadge(id, actorOf(user));
  }

  // ── Home (customer read) ───────────────────────────────────────────────────

  @Public()
  @Get('home')
  @ApiOperation({ summary: 'Resolved home layout for the customer app (public)' })
  getHome() {
    return this.catalog.getHomeLayout();
  }

  // ── Home sections (admin-curated rows + public read) ───────────────────────

  @Public()
  @Get('home-sections')
  @ApiOperation({ summary: 'List home sections (public; supports ?activeOnly & ?inWindow)' })
  listHomeSections(
    @Query('activeOnly') activeOnly?: string,
    @Query('inWindow') inWindow?: string,
  ) {
    return this.catalog.listHomeSections({
      activeOnly: activeOnly === 'true',
      inWindow: inWindow === 'true',
    });
  }

  @Public()
  @Get('home-sections/:id')
  getHomeSection(@Param('id') id: string) {
    return this.catalog.getHomeSection(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('home-sections')
  createHomeSection(
    @Body() dto: CreateHomeSectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createHomeSection(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('home-sections/:id')
  updateHomeSection(
    @Param('id') id: string,
    @Body() dto: UpdateHomeSectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateHomeSection(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('home-sections/:id')
  @ApiOperation({ summary: 'Hard-delete a home section (cascades to its features)' })
  deleteHomeSection(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteHomeSection(id, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('home-sections/reorder')
  reorderHomeSections(
    @Body() dto: ReorderHomeSectionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.reorderHomeSections(dto.orderedIds, actorOf(user));
  }

  // ── Home features (admin curation) ──────────────────────────────────────────

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('home-features')
  listHomeFeatures(@Query('sectionId') sectionId?: string) {
    return this.catalog.listHomeFeatures(sectionId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('home-features/reorder')
  reorderHomeFeatures(
    @Body() dto: ReorderHomeFeaturesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.reorderHomeFeatures(
      dto.sectionId,
      dto.orderedIds,
      actorOf(user),
    );
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('home-features')
  createHomeFeature(
    @Body() dto: CreateHomeFeatureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createHomeFeature(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('home-features/:id')
  updateHomeFeature(
    @Param('id') id: string,
    @Body() dto: UpdateHomeFeatureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateHomeFeature(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('home-features/:id')
  deleteHomeFeature(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteHomeFeature(id, actorOf(user));
  }

  // ── Services ──────────────────────────────────────────────────────────────

  @Public()
  @Get('services')
  listServices(
    @Query('categoryId') categoryId?: string,
    @Query('cityId') cityId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.catalog.listServices({
      categoryId,
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
  createService(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createService(dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('services/:id')
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateService(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('services/:id')
  deactivateService(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deactivateService(id, actorOf(user));
  }

  // ── Service variants ────────────────────────────────────────────────────────

  @Public()
  @Get('services/:serviceId/variants')
  listVariants(
    @Param('serviceId') serviceId: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('tabSlug') tabSlug?: string,
  ) {
    return this.catalog.listVariants(serviceId, {
      activeOnly: activeOnly !== 'false',
      tabSlug,
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('services/:serviceId/variants')
  createVariant(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateServiceVariantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createVariant(serviceId, dto, actorOf(user));
  }

  @Public()
  @Get('variants/:id')
  getVariant(@Param('id') id: string) {
    return this.catalog.getVariant(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('variants/:id')
  updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateServiceVariantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateVariant(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('variants/:id')
  deactivateVariant(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deactivateVariant(id, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Put('variants/:id/tabs')
  @ApiOperation({ summary: "Replace a variant's full tab set atomically" })
  setVariantTabs(
    @Param('id') id: string,
    @Body() dto: SetVariantTabsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.setVariantTabs(id, dto.tabIds, actorOf(user));
  }

  // ── Packages ───────────────────────────────────────────────────────────────

  @Public()
  @Get('services/:serviceId/packages')
  listPackages(
    @Param('serviceId') serviceId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.catalog.listPackages(serviceId, {
      activeOnly: activeOnly !== 'false',
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('services/:serviceId/packages')
  createPackage(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createPackage(serviceId, dto, actorOf(user));
  }

  @Public()
  @Get('packages/:id')
  getPackage(@Param('id') id: string) {
    return this.catalog.getPackage(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('packages/:id')
  updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updatePackage(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('packages/:id')
  deactivatePackage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deactivatePackage(id, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('packages/:id/items')
  addPackageItem(
    @Param('id') id: string,
    @Body() dto: AddPackageItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.addPackageItem(id, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('packages/:id/items/:variantId')
  updatePackageItem(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdatePackageItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updatePackageItem(id, variantId, dto, actorOf(user));
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('packages/:id/items/:variantId')
  removePackageItem(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.removePackageItem(id, variantId, actorOf(user));
  }
}
