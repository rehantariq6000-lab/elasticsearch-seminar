import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/course.entity.js';
import {
  elasticsearchProvider,
  indexNameProvider,
} from './elasticsearch.provider.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course])],
  providers: [elasticsearchProvider, indexNameProvider, SearchService],
  controllers: [SearchController],
  exports: [elasticsearchProvider, indexNameProvider, SearchService],
})
export class SearchModule {}
