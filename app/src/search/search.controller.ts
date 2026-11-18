import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { type ExploreParams, SearchService } from './search.service.js';

const positiveInt = (
  value: string | undefined,
  name: string,
): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new BadRequestException(`${name} must be a positive integer`);
  return parsed;
};

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('courses')
  courses(@Query('q') q?: string) {
    if (!q?.trim())
      throw new BadRequestException('Query parameter q is required');
    return this.search.search(q);
  }

  @Get('explore')
  explore(@Query() query: Record<string, string | undefined>) {
    const params: ExploreParams = {
      q: query.q,
      tag: query.tag || undefined,
      minEcts: positiveInt(query.minEcts, 'minEcts'),
      page: positiveInt(query.page, 'page'),
      size: Math.min(positiveInt(query.size, 'size') ?? 10, 50),
    };
    return this.search.explore(params);
  }

  @Post('reindex')
  @HttpCode(200)
  reindex() {
    return this.search.reindex();
  }
}
