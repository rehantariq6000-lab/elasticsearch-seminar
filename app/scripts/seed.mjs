// npm run db:seed - loads the 42 seed courses into PostgreSQL (DATABASE_URL).
// Start the app once first, so TypeORM has created the "course" table.
// Afterwards: POST /search/reindex (or the button on the web page) fills Elasticsearch.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const courses = JSON.parse(readFileSync(new URL('../../seed/courses.json', import.meta.url), 'utf8'));
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const { rows } = await client.query("SELECT to_regclass('public.course') IS NOT NULL AS ready");
  if (!rows[0].ready) {
    console.error('Table "course" not found: start the app once (npm run start:dev), then run db:seed again.');
    process.exit(1);
  }

  await client.query('BEGIN');
  await client.query('TRUNCATE course RESTART IDENTITY');
  for (const c of courses) {
    await client.query(
      `INSERT INTO course (id, code, title, description, lecturer, ects, "maxParticipants", tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [c.course_id, c.code, c.title, c.description, c.lecturer, c.ects, c.max_participants, c.tags],
    );
  }
  // Continue numbering after the highest seeded id, so POST /courses gets a fresh id.
  await client.query("SELECT setval(pg_get_serial_sequence('course', 'id'), (SELECT max(id) FROM course))");
  await client.query('COMMIT');
  console.log(`Seeded ${courses.length} courses into PostgreSQL. Next: POST /search/reindex`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(`Seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
