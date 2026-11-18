import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchModule } from '../search/search.module.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { Course } from './course.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course]), SearchModule],
  providers: [CoursesService],
  controllers: [CoursesController],
})
export class CoursesModule {}
