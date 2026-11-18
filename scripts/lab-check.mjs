// npm run lab:check                      check the index "courses"
// npm run lab:check -- --index pair-07   check another index
//
// Checks the part of the pair lab that leaves a trace in Elasticsearch:
// task 3 (course 13 was indexed correctly and is searchable). The predictions for
// tasks 1 and 2 live in your notes: compare them with lab/answer-key.md.
import { es, parseArgs, waitForElasticsearch } from './lib.mjs';

const { index } = parseArgs(process.argv.slice(2));
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;

await waitForElasticsearch();
let failed = 0;
const report = (ok, label, hint) => {
  console.log(`${ok ? green('PASS') : red('FAIL')}  ${label}`);
  if (!ok) {
    failed++;
    if (hint) console.log(`      hint: ${hint}`);
  }
};

const count = await es('GET', `/${index}/_count`);
report(count.status === 200, `index "${index}" exists`, 'run: npm run es:setup');
if (count.status !== 200) process.exit(1);

const doc = await es('GET', `/${index}/_doc/13`);
const source = doc.body?._source;
report(doc.status === 200, 'document 13 exists', 'task 3: PUT <index>/_doc/13?refresh=wait_for { ... }');
report(source?.course_id === 13, 'course_id is 13', 'store the application ID in the field course_id');
report(source?.title === 'Advanced Web Development', 'title is "Advanced Web Development"');
report(source?.ects === 5, 'ects is the number 5 (not the string "5")', 'ects must be numeric for the range filter');
report(source?.code === 'WEB320', 'code is WEB320');

const filtered = await es('GET', `/${index}/_search`, {
  _source: false,
  query: {
    bool: {
      must: [{ match: { title: { query: 'web development', operator: 'and' } } }],
      filter: [{ range: { ects: { gte: 5 } } }],
    },
  },
});
const ids = (filtered.body?.hits?.hits ?? []).map((hit) => Number(hit._id)).sort((a, b) => a - b);
report(
  JSON.stringify(ids) === JSON.stringify([10, 13]),
  `both words and at least 5 ECTS returns [10, 13] (got [${ids}])`,
  'is the document searchable yet? Use refresh=wait_for on the write, and check the title tokens.',
);

console.log(failed === 0 ? `\n${green('Task 3 done. Compare your tasks 1 and 2 with lab/answer-key.md.')}` : `\n${red(`${failed} check(s) failed.`)}`);
process.exit(failed === 0 ? 0 : 1);
