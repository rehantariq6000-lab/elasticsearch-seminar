import type { Course } from '../courses/course.entity.js';

// The JSON document stored in Elasticsearch: a flat copy of the searchable fields.
export interface CourseDocument {
  course_id: number;
  code: string;
  title: string;
  description: string;
  lecturer: string;
  ects: number;
  max_participants: number;
  tags: string[];
}

// Postgres row in, Elasticsearch document out. The Postgres id is also the document _id.
export function toDocument(course: Course): CourseDocument {
  return {
    course_id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    lecturer: course.lecturer,
    ects: course.ects,
    max_participants: course.maxParticipants,
    tags: course.tags,
  };
}
