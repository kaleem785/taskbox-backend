import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateReviewDto,
  RespondReviewDto,
  ReviewQueryDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiBearerAuth()
@ApiTags('reviews')
@Roles(Role.ADMIN)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() q: ReviewQueryDto) {
    return this.reviews.list(q);
  }

  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviews.create(dto);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondReviewDto) {
    return this.reviews.respond(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
