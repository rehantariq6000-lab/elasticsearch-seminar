// End-to-end tests: real NestJS app, real PostgreSQL, real Elasticsearch.
// Needs the stack from the repo root:  docker compose up -d elasticsearch db
//
// What these tests prove, in plain words:
//   1. create     a new course is saved in Postgres AND findable in the index at once
//   2. typo       a typo still finds it in Elasticsearch, while SQL ILIKE finds nothing
//   3. update     changing the title in Postgres changes what search finds
//   4. delete     a deleted course disappears from both systems
//   5. reindex    if the index drifts away from Postgres, POST /search/reindex repairs it
//   6. filters    minEcts, tag and facets work together with the text query
//   7. validation bad input gives 400, a duplicate code gives 409, unknown ids give 404
import type { INestApplication } from '@nestjs/common';
import type { Client } from '@elastic/elasticsearch';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { ES, ES_INDEX } from '../search/elasticsearch.provider.js';
import { Course } from './course.entity.js';

const TEST_INDEX = 'courses_e2e';
const run = Date.now().toString(36);

describe('Courses and search (e2e)', () => {
  let app: INestApplication;
  let es: Client;
  let dataSource: DataSource;
  const createdIds: number[] = [];

  async function createCourse(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .send({
        code: `E2E-${run}-${createdIds.length}`,
        title: 'Quasar Astrophysics Lab',
        description:
          'Observe distant galaxies and model how light bends around heavy objects.',
        lecturer: 'Dr. Weber',
        ects: 5,
        maxParticipants: 20,
        tags: ['e2e', 'science'],
        ...overrides,
      });
    if (response.status === 201) createdIds.push(response.body.id);
    return response;
  }

  const searchIds = async (q: string) => {
    const response = await request(app.getHttpServer())
      .get('/search/courses')
      .query({ q });
    expect(response.status).toBe(200);
    return (response.body as { id: number }[]).map((hit) => hit.id);
  };

  beforeAll(async () => {
    // A separate index, so the tests never touch the one you demo with.
    process.env.ELASTICSEARCH_INDEX = TEST_INDEX;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    es = app.get<Client>(ES);
    dataSource = app.get(DataSource);
    expect(app.get(ES_INDEX)).toBe(TEST_INDEX);
  });

  afterAll(async () => {
    if (createdIds.length > 0)
      await dataSource.getRepository(Course).delete(createdIds);
    await es.indices.delete({ index: TEST_INDEX }, { ignore: [404] });
    await app.close();
  });

  it('create: a new course is saved and immediately searchable', async () => {
    const created = await createCourse();
    expect(created.status).toBe(201);
    expect(typeof created.body.id).toBe('number');

    const response = await request(app.getHttpServer())
      .get('/search/courses')
      .query({ q: 'astrophysics' });
    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(created.body.id);
    expect(response.body[0].title).toBe('Quasar Astrophysics Lab');
    expect(typeof response.body[0].score).toBe('number');
  });

  it('typo: Elasticsearch finds "quasr", SQL ILIKE finds nothing', async () => {
    const created = await createCourse({ title: 'Quasar Observation Studio' });

    expect(await searchIds('quasr')).toContain(created.body.id);

    const like = await request(app.getHttpServer())
      .get('/courses/like')
      .query({ q: 'quasr' });
    expect(like.status).toBe(200);
    expect(like.body.total).toBe(0);
  });

  it('update: a changed title changes what search finds', async () => {
    const created = await createCourse({
      title: 'Nebula Cartography Lab',
      description: 'Draw maps of glowing gas clouds.',
    });
    expect(await searchIds('nebula')).toContain(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/courses/${created.body.id}`)
      .send({ title: 'Pulsar Timing Lab' });
    expect(updated.status).toBe(200);

    expect(await searchIds('pulsar')).toContain(created.body.id);
    expect(await searchIds('nebula')).not.toContain(created.body.id);
  });

  it('delete: a deleted course disappears from Postgres and from the index', async () => {
    const created = await createCourse({
      title: 'Wormhole Navigation Basics',
      description: 'Charts for shortcuts.',
    });
    expect(await searchIds('wormhole')).toContain(created.body.id);

    const deleted = await request(app.getHttpServer()).delete(
      `/courses/${created.body.id}`,
    );
    expect(deleted.status).toBe(204);

    expect(await searchIds('wormhole')).not.toContain(created.body.id);
    expect(
      (await request(app.getHttpServer()).get(`/courses/${created.body.id}`))
        .status,
    ).toBe(404);
  });

  it('reindex: POST /search/reindex repairs an index that drifted away from Postgres', async () => {
    const created = await createCourse({
      title: 'Magnetar Field Workshop',
      description: 'Strong fields.',
    });
    expect(await searchIds('magnetar')).toContain(created.body.id);

    // Simulate drift: the document disappears from Elasticsearch, Postgres still has the row.
    await es.delete({
      index: TEST_INDEX,
      id: String(created.body.id),
      refresh: true,
    });
    expect(await searchIds('magnetar')).not.toContain(created.body.id);

    const reindex = await request(app.getHttpServer()).post('/search/reindex');
    expect(reindex.status).toBe(200);
    expect(reindex.body.index).toBe(TEST_INDEX);
    expect(reindex.body.indexed).toBeGreaterThanOrEqual(1);

    expect(await searchIds('magnetar')).toContain(created.body.id);
  });

  it('filters: minEcts and tag narrow the text query, facets count the tags', async () => {
    const small = await createCourse({
      title: 'Zephyr Weather Basics',
      ects: 3,
      tags: ['e2e', 'weather'],
    });
    const large = await createCourse({
      title: 'Zephyr Climate Modelling',
      ects: 6,
      tags: ['e2e', 'climate'],
    });

    const all = await request(app.getHttpServer())
      .get('/search/explore')
      .query({ q: 'zephyr' });
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    const tagKeys = all.body.facets.tags.map(
      (bucket: { key: string }) => bucket.key,
    );
    expect(tagKeys).toEqual(
      expect.arrayContaining(['e2e', 'weather', 'climate']),
    );

    const min5 = await request(app.getHttpServer())
      .get('/search/explore')
      .query({ q: 'zephyr', minEcts: 5 });
    expect(min5.body.hits.map((hit: { id: number }) => hit.id)).toEqual([
      large.body.id,
    ]);

    const tagged = await request(app.getHttpServer())
      .get('/search/explore')
      .query({ q: 'zephyr', tag: 'weather' });
    expect(tagged.body.hits.map((hit: { id: number }) => hit.id)).toEqual([
      small.body.id,
    ]);
    // post_filter: the facet still lists the other tags while one is selected
    expect(
      tagged.body.facets.tags.map((bucket: { key: string }) => bucket.key),
    ).toContain('climate');
  });

  it('highlights the matched words and escapes HTML in the source text', async () => {
    const created = await createCourse({
      title: 'Aurora Photography',
      description: 'Shoot <script>alert(1)</script> the northern lights.',
    });
    const response = await request(app.getHttpServer())
      .get('/search/explore')
      .query({ q: 'aurora' });
    const hit = response.body.hits.find(
      (h: { id: number }) => h.id === created.body.id,
    );
    expect(hit.highlight.title).toBe('<mark>Aurora</mark> Photography');

    const withScript = await request(app.getHttpServer())
      .get('/search/explore')
      .query({ q: 'northern lights' });
    const scripted = withScript.body.hits.find(
      (h: { id: number }) => h.id === created.body.id,
    );
    expect(JSON.stringify(scripted.highlight.description)).not.toContain(
      '<script>',
    );
  });

  it('validation: bad input is 400, a duplicate code is 409, an unknown id is 404', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/courses')
          .send({ title: 'No code' })
      ).status,
    ).toBe(400);
    expect((await createCourse({ ects: 'many' })).status).toBe(400);

    const first = await createCourse({
      code: `DUP-${run}`,
      title: 'Duplicate Check One',
    });
    expect(first.status).toBe(201);
    expect(
      (await createCourse({ code: `DUP-${run}`, title: 'Duplicate Check Two' }))
        .status,
    ).toBe(409);

    expect(
      (await request(app.getHttpServer()).get('/search/courses')).status,
    ).toBe(400);
    expect(
      (await request(app.getHttpServer()).get('/courses/abc')).status,
    ).toBe(400);
    expect(
      (await request(app.getHttpServer()).get('/courses/99999999')).status,
    ).toBe(404);
  });
});
