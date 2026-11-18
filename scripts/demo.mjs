// npm run demo               run the whole live demo against your Elasticsearch and check every result
// npm run demo -- --step     pause after every step (press Enter), handy as a console fallback on stage
// npm run demo -- --index pair-07
//
// The requests live in demo/requests.mjs. Run "npm run es:setup" first.
import { createInterface } from 'node:readline/promises';
import { steps } from '../demo/requests.mjs';
import { es, parseArgs, waitForElasticsearch } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const stepMode = process.argv.includes('--step');

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

function check(step, response) {
  const { expect } = step;
  const problems = [];
  const body = response.body;
  const hits = body?.hits?.hits ?? [];

  if (response.status !== (expect.status ?? 200)) problems.push(`status ${response.status}, expected ${expect.status ?? 200}`);
  if (expect.total !== undefined && body?.hits?.total?.value !== expect.total)
    problems.push(`total ${body?.hits?.total?.value}, expected ${expect.total}`);
  if (expect.ids) {
    const got = hits.map((hit) => Number(hit._id)).sort((a, b) => a - b);
    const want = [...expect.ids].sort((a, b) => a - b);
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`ids [${got}], expected [${want}]`);
  }
  if (expect.firstId !== undefined && Number(hits[0]?._id) !== expect.firstId)
    problems.push(`first hit is ${hits[0]?._id}, expected ${expect.firstId}`);
  if (expect.firstTitle && hits[0]?._source?.title !== expect.firstTitle)
    problems.push(`first title "${hits[0]?._source?.title}", expected "${expect.firstTitle}"`);
  if (expect.tokens) {
    const got = (body?.tokens ?? []).map((token) => token.token);
    if (JSON.stringify(got) !== JSON.stringify(expect.tokens)) problems.push(`tokens [${got}], expected [${expect.tokens}]`);
  }
  if (expect.bucket) {
    const first = body?.aggregations?.by_tag?.buckets?.[0];
    if (first?.key !== expect.bucket.key || first?.doc_count !== expect.bucket.count)
      problems.push(`first bucket ${first?.key}=${first?.doc_count}, expected ${expect.bucket.key}=${expect.bucket.count}`);
  }
  if (expect.contains && !JSON.stringify(body).includes(expect.contains)) problems.push(`response does not contain "${expect.contains}"`);
  return problems;
}

function summarize(response) {
  const body = response.body;
  if (body?.hits?.hits) {
    const lines = [`hits.total = ${body.hits.total.value}`];
    for (const hit of body.hits.hits.slice(0, 5)) {
      const label = hit._source?.title ?? '';
      const score = typeof hit._score === 'number' ? `  score ${hit._score.toFixed(2)}` : '';
      lines.push(`  _id ${String(hit._id).padEnd(3)} ${label}${score}`);
    }
    if (body.hits.hits.length > 5) lines.push(`  ... ${body.hits.hits.length - 5} more`);
    return lines.join('\n');
  }
  if (body?.tokens) return `tokens: ${body.tokens.map((token) => token.token).join('  ')}`;
  if (body?.aggregations?.by_tag)
    return body.aggregations.by_tag.buckets.map((bucket) => `  ${bucket.key.padEnd(12)} ${bucket.doc_count}`).join('\n');
  if (body?.error) return `error: ${body.error.root_cause?.[0]?.reason ?? body.error.reason ?? JSON.stringify(body.error)}`;
  if (body?.tagline) return `${body.version.number}  "${body.tagline}"`;
  return JSON.stringify(body);
}

await waitForElasticsearch();

const rl = stepMode ? createInterface({ input: process.stdin, output: process.stdout }) : null;
const all = steps(args.index);
let failures = 0;
let lastPart = '';

for (const step of all) {
  if (step.part !== lastPart) {
    console.log(`\n${bold(`== ${step.part} ==`)}`);
    lastPart = step.part;
  }
  console.log(`\n${bold(step.title)}`);
  console.log(dim(step.note));
  console.log(dim(`${step.method} ${step.path}`));
  if (step.body) console.log(dim(JSON.stringify(step.body)));

  const response = await es(step.method, step.path, step.body);
  console.log(summarize(response));

  const problems = check(step, response);
  if (problems.length === 0) console.log(green('  OK'));
  else {
    failures++;
    console.log(red(`  FAILED: ${problems.join('; ')}`));
  }
  if (rl) await rl.question(dim('  (Enter for the next step) '));
}
rl?.close();

console.log(
  failures === 0
    ? `\n${green(`All ${all.length} steps behaved as expected.`)}`
    : `\n${red(`${failures} of ${all.length} steps did not match. Did you run "npm run es:reset"?`)}`,
);
process.exit(failures === 0 ? 0 : 1);
