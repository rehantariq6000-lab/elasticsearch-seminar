import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Client } from '@elastic/elasticsearch';
import { Repository } from 'typeorm';
import { ES, ES_INDEX } from '../search/elasticsearch.provider.js';
import { toDocument } from '../search/course-document.js';
import { Course } from './course.entity.js';
import type { CreateCourse, UpdateCourse } from './create-course.js';

// PostgreSQL error 23505 = unique violation (here: a course with this code exists)
const isUniqueViolation = (error: unknown) =>
  (error as { code?: string; driverError?: { code?: string } }).driverError
    ?.code === '23505' || (error as { code?: string }).code === '23505';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @Inject(ES) private readonly es: Client,
    @Inject(ES_INDEX) private readonly index: string,
  ) {}

  findAll() {
    return this.courses.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number) {
    const course = await this.courses.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  // Dual write: PostgreSQL first (it is the truth), then a copy into the index.
  // If the second call fails, the two systems drift apart: POST /search/reindex repairs it.
  async create(dto: CreateCourse) {
    const course = await this.save(this.courses.create(dto));

    // TODO (stretch exercise, step 2): index a copy of the new course.
    //   - this.es.index({ index: this.index, id: String(course.id), document: toDocument(course), ... })
    //   - the same id in both places: the Postgres id is the Elasticsearch _id
    //   - refresh: 'wait_for' makes the response wait until the document is searchable
    // Compare with `update` below, which already does it.

    return course;
  }

  async update(id: number, dto: UpdateCourse) {
    const course = Object.assign(await this.findOne(id), dto);
    const saved = await this.save(course);
    // Same _id again: Elasticsearch replaces the whole document.
    await this.es.index({
      index: this.index,
      id: String(saved.id),
      document: toDocument(saved),
      refresh: 'wait_for',
    });
    return saved;
  }

  async remove(id: number) {
    const course = await this.findOne(id);
    await this.courses.remove(course);
    await this.es.delete(
      { index: this.index, id: String(id), refresh: 'wait_for' },
      { ignore: [404] },
    );
  }

  // The "before" picture for the demo: plain SQL pattern matching.
  // ILIKE '%databse%' finds nothing, which is the whole point.
  async likeSearch(q: string) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await this.courses
      .createQueryBuilder('course')
      .where(
        'course.title ILIKE :pattern OR course.description ILIKE :pattern',
        { pattern },
      )
      .orderBy('course.id', 'ASC')
      .limit(20)
      .getMany();
    return { total: rows.length, hits: rows };
  }

  private async save(course: Course) {
    try {
      return await this.courses.save(course);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          `A course with code "${course.code}" already exists`,
        );
      throw error;
    }
  }
}
