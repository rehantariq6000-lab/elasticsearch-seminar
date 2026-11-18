// npm run es:setup            create the "courses" index and load the 42 seed courses
// npm run es:reset            delete the index first, then do the same
// node scripts/setup.mjs --index pair-07     use another index name (for example one per pair)
import { es, loadCourses, loadMapping, parseArgs, plural, toBulkBody, waitForElasticsearch, ES_URL } from './lib.mjs';

const { index, reset } = parseArgs(process.argv.slice(2));

await waitForElasticsearch();

if (reset) {
  await es('DELETE', `/${index}`);
  console.log(`Deleted index "${index}" (if it existed).`);
}

const exists = (await es('HEAD', `/${index}`)).status === 200;
if (!exists) {
  const created = await es('PUT', `/${index}`, loadMapping());
  if (created.status !== 200) {
    console.error('Could not create the index:', JSON.stringify(created.body));
    process.exit(1);
  }
  console.log(`Created index "${index}" with the course mapping.`);
} else {
  console.log(`Index "${index}" already exists, documents with the same _id are replaced.`);
}

const courses = loadCourses();
const bulk = await es('POST', '/_bulk?refresh=true', toBulkBody(index, courses), { ndjson: true });
if (bulk.status !== 200 || bulk.body.errors) {
  console.error('Bulk load failed:', JSON.stringify(bulk.body).slice(0, 500));
  process.exit(1);
}

const { body } = await es('GET', `/${index}/_count`);
console.log(`Loaded ${plural(courses.length, 'course')}. The index now holds ${plural(body.count, 'document')}.`);
console.log(`Elasticsearch: ${ES_URL}   Kibana: http://localhost:5601 (Dev Tools)`);
