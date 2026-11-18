import { readFileSync } from 'node:fs';
import { COURSE_MAPPING } from './course-index.js';

describe('course index mapping', () => {
  it('is identical to seed/mapping.json, which the scripts and the slides use', () => {
    const file = JSON.parse(
      readFileSync(
        new URL('../../../seed/mapping.json', import.meta.url),
        'utf8',
      ),
    );
    expect(COURSE_MAPPING).toEqual(file.mappings);
  });
});
