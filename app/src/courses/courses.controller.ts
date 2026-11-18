import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import {
  type CreateCourse,
  parseCourse,
  type UpdateCourse,
} from './create-course.js';

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  findAll() {
    return this.courses.findAll();
  }

  // Declared before ":id", otherwise "like" would be read as an id.
  @Get('like')
  like(@Query('q') q?: string) {
    if (!q?.trim())
      throw new BadRequestException('Query parameter q is required');
    return this.courses.likeSearch(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.courses.findOne(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.courses.create(
      parseCourse(body, { partial: false }) as CreateCourse,
    );
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.courses.update(
      id,
      parseCourse(body, { partial: true }) as UpdateCourse,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.courses.remove(id);
  }
}
