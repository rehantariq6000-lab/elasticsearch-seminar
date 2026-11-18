import type { estypes } from '@elastic/elasticsearch';

// Must stay identical to ../../seed/mapping.json (a test checks that).
export const COURSE_MAPPING: estypes.MappingTypeMapping = {
  properties: {
    course_id: { type: 'integer' },
    code: { type: 'keyword' },
    title: { type: 'text', analyzer: 'standard' },
    description: { type: 'text', analyzer: 'english' },
    lecturer: { type: 'keyword' },
    ects: { type: 'integer' },
    max_participants: { type: 'integer' },
    tags: { type: 'keyword' },
  },
};
