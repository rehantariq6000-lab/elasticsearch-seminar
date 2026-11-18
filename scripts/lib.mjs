// Shared helpers for the scripts in this folder. Plain Node 22+, no dependencies.
import { readFileSync } from 'node:fs';

export const ES_URL = (process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200').replace(/\/$/, '');

export function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

// --index <name>, --reset, plus any other --flag value pair
export function parseArgs(argv) {
  const args = { index: 'courses', reset: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--reset') args.reset = true;
    else if (arg.startsWith('--')) args[arg.slice(2)] = argv[++i];
  }
  return args;
}

// One tiny wrapper around fetch: returns { status, body } and never throws on HTTP errors.
export async function es(method, path, body, { ndjson = false } = {}) {
  // Kibana shows "GET ... { body }", but fetch() forbids a body on GET.
  // Elasticsearch treats POST on _search and _analyze exactly the same way.
  const verb = method === 'GET' && body !== undefined ? 'POST' : method;
  const response = await fetch(`${ES_URL}/${path.replace(/^\//, '')}`, {
    method: verb,
    headers: { 'content-type': ndjson ? 'application/x-ndjson' : 'application/json' },
    body: body === undefined ? undefined : ndjson ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep the raw text
  }
  return { status: response.status, body: parsed };
}

export async function waitForElasticsearch(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const { status } = await es('GET', '/');
      if (status === 200) return;
      lastError = `HTTP ${status}`;
    } catch (error) {
      lastError = error.cause?.code ?? error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Elasticsearch is not reachable at ${ES_URL} (${lastError}). Did you run "docker compose up -d"?`,
  );
}

export const loadCourses = () => readJson('seed/courses.json');
export const loadMapping = () => readJson('seed/mapping.json');

// Elasticsearch's bulk format: one action line, then one document line, as NDJSON.
export function toBulkBody(index, courses) {
  return (
    courses
      .flatMap((course) => [JSON.stringify({ index: { _index: index, _id: course.course_id } }), JSON.stringify(course)])
      .join('\n') + '\n'
  );
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
