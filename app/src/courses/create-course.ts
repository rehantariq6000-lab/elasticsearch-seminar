import { BadRequestException } from '@nestjs/common';
import type { Course } from './course.entity.js';

export type CreateCourse = Omit<Course, 'id'>;
export type UpdateCourse = Partial<CreateCourse>;

const text = (value: unknown, field: string, max: number): string => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new BadRequestException(
      `${field} must be a non-empty string of at most ${max} characters`,
    );
  }
  return value.trim();
};

const integer = (
  value: unknown,
  field: string,
  min: number,
  max: number,
): number => {
  if (
    !Number.isInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  ) {
    throw new BadRequestException(
      `${field} must be an integer between ${min} and ${max}`,
    );
  }
  return value as number;
};

// Small hand-written validation: enough for the seminar, no extra library needed.
export function parseCourse(
  body: unknown,
  { partial }: { partial: boolean },
): UpdateCourse {
  if (typeof body !== 'object' || body === null)
    throw new BadRequestException('Body must be a JSON object');
  const input = body as Record<string, unknown>;
  const out: UpdateCourse = {};
  const take = <K extends keyof CreateCourse>(
    key: K,
    parse: (value: unknown) => CreateCourse[K],
  ) => {
    if (input[key] === undefined) {
      if (!partial) throw new BadRequestException(`${key} is required`);
      return;
    }
    out[key] = parse(input[key]);
  };

  take('code', (v) => text(v, 'code', 20));
  take('title', (v) => text(v, 'title', 200));
  take('description', (v) => text(v, 'description', 5000));
  take('lecturer', (v) => text(v, 'lecturer', 100));
  take('ects', (v) => integer(v, 'ects', 1, 30));
  take('maxParticipants', (v) => integer(v, 'maxParticipants', 1, 1000));
  take('tags', (v) => {
    if (!Array.isArray(v) || v.some((tag) => typeof tag !== 'string')) {
      throw new BadRequestException('tags must be an array of strings');
    }
    return v as string[];
  });
  return out;
}
